/**
 * Gerenciador de salas online P2P (PeerJS / WebRTC) com suporte a sala com ou sem senha
 * e autoridade do anfitrião (anti-trapaça: oculta valores das peças da mão do próprio cliente).
 */

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PEER_PREFIX = 'impar2d-sala-';

export function generateRoomCode(len = 5) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
  }
  return out;
}

/**
 * Remove valores secretos antes de enviar o estado da partida para um convidado.
 */
export function sanitizeStateForPlayer(state, targetIndex, disputeReveal = null) {
  return {
    playerCount: state.playerCount,
    activeColors: state.activeColors,
    removedColor: state.removedColor,
    tilesPerPlayer: state.tilesPerPlayer,
    undistributedCount: state.undistributedCount,
    round: state.round,
    totalRounds: state.totalRounds,
    disputeNumber: state.disputeNumber,
    totalDisputesPerRound: state.totalDisputesPerRound,
    players: state.players.map((p) => {
      const isSelf = p.index === targetIndex;
      return {
        index: p.index,
        name: p.name,
        isHuman: p.isHuman,
        difficulty: p.difficulty,
        // Jogador NÃO recebe os valores numéricos da própria mão
        hand: isSelf
          ? p.hand.map((t) => ({ id: t.id, color: t.color, value: null, parity: t.parity }))
          : p.hand.map((t) => ({ ...t })),
        // Pontuação da rodada é aberta apenas para o próprio dono; fechada para os demais
        penaltyTiles: isSelf
          ? p.penaltyTiles.map((t) => ({ ...t }))
          : p.penaltyTiles.map((t) => ({ id: t.id, color: t.color, value: null, parity: t.parity })),
        roundScores: [...p.roundScores],
        totalScore: p.totalScore,
      };
    }),
    bagTiles: state.bagTiles.map((_, idx) => ({ id: `bag_${idx}` })),
    discardPile: state.discardPile.map((_, idx) => ({ id: `disc_${idx}` })),
    currentDispute: {
      leaderIndex: state.currentDispute.leaderIndex,
      turnIndex: state.currentDispute.turnIndex,
      plays: state.currentDispute.plays.map((pl) => ({ ...pl, tile: { ...pl.tile } })),
      requiredColor: state.currentDispute.requiredColor,
      forcedByTen: state.currentDispute.forcedByTen,
      lastPlayedWasTen: state.currentDispute.lastPlayedWasTen,
      pendingWinnerIndex: state.currentDispute.pendingWinnerIndex,
      lowestCandidates: state.currentDispute.lowestCandidates.map((t) => ({ ...t })),
    },
    lastDisputeResult: state.lastDisputeResult
      ? {
          ...state.lastDisputeResult,
          winningTile: { ...state.lastDisputeResult.winningTile },
          penaltyTile: { ...state.lastDisputeResult.penaltyTile },
          plays: state.lastDisputeResult.plays.map((pl) => ({ ...pl, tile: { ...pl.tile } })),
        }
      : null,
    lastRoundSummary: state.lastRoundSummary || null,
    phase: state.phase,
    log: state.log.slice(0, 15),
    winners: [...state.winners],
    disputeReveal,
  };
}

export class OnlineRoomManager {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.peer = null;
    this.role = null; // 'host' | 'guest'
    this.roomCode = null;
    this.password = '';
    this.maxPlayers = 4;
    this.hostName = '';
    this.myIndex = 0;
    this.inMatch = false;
    this.guests = []; // { peerId, conn, name, index }
    this.hostConn = null;
  }

  _ensurePeerJs() {
    if (!window.Peer) {
      throw new Error('Biblioteca PeerJS não carregada.');
    }
  }

  /**
   * Cria uma sala como Anfitrião.
   */
  async createRoom({ hostName, maxPlayers, password = '' }) {
    this._ensurePeerJs();
    this.destroy();

    this.role = 'host';
    this.hostName = hostName;
    this.maxPlayers = maxPlayers;
    this.password = password.trim();
    this.myIndex = 0;
    this.inMatch = false;
    this.guests = [];

    let attempts = 0;
    while (attempts < 4) {
      attempts++;
      const code = generateRoomCode(5);
      try {
        await this._openHostPeer(code);
        this.roomCode = code;
        return {
          roomCode: code,
          hasPassword: Boolean(this.password),
          maxPlayers: this.maxPlayers,
          members: this.getMembersSnapshot(),
        };
      } catch (err) {
        if (err?.type === 'unavailable-id' && attempts < 4) continue;
        throw err;
      }
    }
    throw new Error('Não foi possível reservar um código de sala. Tente novamente.');
  }

  _openHostPeer(code) {
    return new Promise((resolve, reject) => {
      const peer = new window.Peer(`${PEER_PREFIX}${code}`, { debug: 0 });
      let settled = false;

      peer.on('open', () => {
        settled = true;
        this.peer = peer;
        this._attachHostListeners(peer);
        resolve();
      });

      peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          try { peer.destroy(); } catch {}
          reject(err);
        } else {
          this.callbacks.onError?.(err.message || 'Erro de conexão na sala.');
        }
      });
    });
  }

  _attachHostListeners(peer) {
    peer.on('connection', (conn) => {
      let joinedGuest = null;

      conn.on('data', (msg) => {
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'JOIN_REQUEST') {
          if (this.inMatch) {
            conn.send({ type: 'JOIN_REJECTED', reason: 'ALREADY_STARTED', message: 'A partida já começou.' });
            setTimeout(() => conn.close(), 200);
            return;
          }
          if (1 + this.guests.length >= this.maxPlayers) {
            conn.send({ type: 'JOIN_REJECTED', reason: 'ROOM_FULL', message: 'A sala já está cheia.' });
            setTimeout(() => conn.close(), 200);
            return;
          }
          if (this.password && (msg.password || '').trim() !== this.password) {
            conn.send({
              type: 'JOIN_REJECTED',
              reason: 'WRONG_PASSWORD',
              message: msg.password ? 'Senha incorreta.' : 'Esta sala exige senha.',
            });
            setTimeout(() => conn.close(), 200);
            return;
          }

          const guestIndex = 1 + this.guests.length;
          const cleanName = String(msg.name || '').trim().slice(0, 16) || `Jogador ${guestIndex + 1}`;
          joinedGuest = { peerId: conn.peer, conn, name: cleanName, index: guestIndex };
          this.guests.push(joinedGuest);

          conn.send({
            type: 'JOIN_ACCEPTED',
            roomCode: this.roomCode,
            hasPassword: Boolean(this.password),
            maxPlayers: this.maxPlayers,
            assignedIndex: guestIndex,
            members: this.getMembersSnapshot(),
          });

          this.broadcastRoomUpdate();
          this.callbacks.onRoomUpdate?.(this.getMembersSnapshot());
          return;
        }

        if (joinedGuest) {
          this.callbacks.onGuestAction?.(joinedGuest.index, msg);
        }
      });

      conn.on('close', () => {
        if (!joinedGuest) return;
        const idx = joinedGuest.index;
        const name = joinedGuest.name;
        this.guests = this.guests.filter((g) => g !== joinedGuest);

        if (!this.inMatch) {
          // Reindexa assentos na sala de espera
          this.guests.forEach((g, i) => {
            g.index = i + 1;
            g.conn.send({ type: 'REASSIGN_INDEX', assignedIndex: g.index });
          });
          this.broadcastRoomUpdate();
          this.callbacks.onRoomUpdate?.(this.getMembersSnapshot());
        } else {
          this.callbacks.onGuestDisconnectedInMatch?.(idx, name);
        }
      });
    });
  }

  getMembersSnapshot() {
    const list = [{ index: 0, name: this.hostName, isHost: true, isBot: false }];
    for (const g of this.guests) {
      list.push({ index: g.index, name: g.name, isHost: false, isBot: false });
    }
    return list;
  }

  broadcastRoomUpdate() {
    if (this.role !== 'host') return;
    const members = this.getMembersSnapshot();
    for (const g of this.guests) {
      if (g.conn.open) {
        g.conn.send({
          type: 'ROOM_UPDATE',
          members,
          maxPlayers: this.maxPlayers,
          hasPassword: Boolean(this.password),
        });
      }
    }
  }

  broadcastGameState(state, { disputeReveal = null, toast = null, event = null } = {}) {
    if (this.role !== 'host') return;
    this.inMatch = true;
    for (const g of this.guests) {
      if (g.conn.open) {
        g.conn.send({
          type: 'STATE_SYNC',
          state: sanitizeStateForPlayer(state, g.index, disputeReveal),
          toast,
          event,
        });
      }
    }
  }

  broadcastReturnToLobby() {
    if (this.role !== 'host') return;
    this.inMatch = false;
    for (const g of this.guests) {
      if (g.conn.open) {
        g.conn.send({ type: 'RETURN_TO_LOBBY' });
      }
    }
  }

  /**
   * Conecta como Convidado em uma sala existente.
   */
  joinRoom({ roomCode, playerName, password = '' }) {
    this._ensurePeerJs();
    this.destroy();

    const cleanCode = String(roomCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return Promise.reject(new Error('Informe o código da sala.'));
    }

    this.role = 'guest';
    this.roomCode = cleanCode;

    return new Promise((resolve, reject) => {
      const peer = new window.Peer({ debug: 0 });
      this.peer = peer;
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.destroy();
          reject(new Error('Tempo esgotado ao procurar a sala. Confira o código.'));
        }
      }, 12000);

      peer.on('open', () => {
        const conn = peer.connect(`${PEER_PREFIX}${cleanCode}`, { reliable: true });
        this.hostConn = conn;

        conn.on('open', () => {
          conn.send({
            type: 'JOIN_REQUEST',
            name: playerName,
            password,
          });
        });

        conn.on('data', (msg) => {
          if (!msg || typeof msg !== 'object') return;

          if (msg.type === 'JOIN_REJECTED') {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              this.destroy();
              reject(new Error(msg.message || 'Entrada recusada na sala.'));
            }
            return;
          }

          if (msg.type === 'JOIN_ACCEPTED') {
            settled = true;
            clearTimeout(timeout);
            this.myIndex = msg.assignedIndex;
            this.maxPlayers = msg.maxPlayers;
            resolve(msg);
            return;
          }

          if (msg.type === 'REASSIGN_INDEX') {
            this.myIndex = msg.assignedIndex;
            return;
          }

          if (msg.type === 'ROOM_UPDATE') {
            this.callbacks.onRoomUpdate?.(msg.members, msg);
            return;
          }

          if (msg.type === 'STATE_SYNC') {
            this.inMatch = true;
            this.callbacks.onStateSync?.(msg);
            return;
          }

          if (msg.type === 'RETURN_TO_LOBBY') {
            this.inMatch = false;
            this.callbacks.onHostReturnedLobby?.();
          }
        });

        conn.on('close', () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error('Não foi possível conectar à sala.'));
          } else {
            this.callbacks.onHostDisconnected?.();
          }
        });

        conn.on('error', () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error('Sala não encontrada ou inacessível.'));
          }
        });
      });

      peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this.destroy();
          if (err?.type === 'peer-unavailable') {
            reject(new Error('Sala não encontrada. Verifique o código digitado.'));
          } else {
            reject(new Error(err?.message || 'Erro de conexão com o servidor de salas.'));
          }
        }
      });
    });
  }

  sendToHost(action) {
    if (this.role !== 'guest' || !this.hostConn || !this.hostConn.open) return;
    this.hostConn.send(action);
  }

  destroy() {
    for (const g of this.guests) {
      try { g.conn.close(); } catch {}
    }
    this.guests = [];
    if (this.hostConn) {
      try { this.hostConn.close(); } catch {}
      this.hostConn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
    this.role = null;
    this.roomCode = null;
    this.inMatch = false;
  }
}
