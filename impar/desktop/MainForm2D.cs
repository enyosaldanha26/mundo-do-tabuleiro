using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Impar2DDesktop
{
    public sealed class MainForm2D : Form
    {
        private readonly WebView2 _webView;
        private bool _isFullscreen;
        private FormBorderStyle _prevBorderStyle;
        private FormWindowState _prevWindowState;
        private Rectangle _prevBounds;

        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        public MainForm2D()
        {
            try { SetProcessDPIAware(); } catch { }

            Text = "ÍMPAR — Edição 2D Minimalista";
            Width = 1360;
            Height = 860;
            MinimumSize = new Size(960, 660);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(245, 247, 250);
            Icon = CreateMinimalIcon();
            KeyPreview = true;

            _webView = new WebView2();
            _webView.Dock = DockStyle.Fill;
            _webView.DefaultBackgroundColor = Color.FromArgb(245, 247, 250);
            Controls.Add(_webView);

            Load += OnFormLoad;
            KeyDown += OnMainKeyDown;
        }

        private async void OnFormLoad(object sender, EventArgs e)
        {
            await InitializeWebViewAsync();
        }

        private async Task InitializeWebViewAsync()
        {
            string userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Impar2D",
                "WebView2"
            );
            Directory.CreateDirectory(userDataFolder);

            CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await _webView.EnsureCoreWebView2Async(env);

            CoreWebView2Settings settings = _webView.CoreWebView2.Settings;
            settings.AreDefaultContextMenusEnabled = false;
            settings.AreBrowserAcceleratorKeysEnabled = true;
            settings.IsZoomControlEnabled = false;
            settings.IsStatusBarEnabled = false;

            string appDir = ResolveAppDirectory();
            _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "impar2d.local",
                appDir,
                CoreWebView2HostResourceAccessKind.Allow
            );

            _webView.CoreWebView2.Navigate("https://impar2d.local/index.html");
        }

        private static string ResolveAppDirectory()
        {
            string nextToExe = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "impar_2d");
            if (Directory.Exists(nextToExe) && File.Exists(Path.Combine(nextToExe, "index.html")))
                return nextToExe;

            string dir = AppDomain.CurrentDomain.BaseDirectory;
            for (int i = 0; i < 6; i++)
            {
                string candidate = Path.Combine(dir, "impar_2d");
                if (Directory.Exists(candidate) && File.Exists(Path.Combine(candidate, "index.html")))
                    return candidate;
                DirectoryInfo parent = Directory.GetParent(dir);
                if (parent == null) break;
                dir = parent.FullName;
            }

            throw new DirectoryNotFoundException("Pasta 'impar_2d' não encontrada.");
        }

        private void OnMainKeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.F11 || (e.Alt && e.KeyCode == Keys.Enter))
            {
                ToggleFullscreen();
                e.Handled = true;
            }
        }

        private void ToggleFullscreen()
        {
            if (!_isFullscreen)
            {
                _prevBorderStyle = FormBorderStyle;
                _prevWindowState = WindowState;
                _prevBounds = Bounds;

                FormBorderStyle = FormBorderStyle.None;
                WindowState = FormWindowState.Normal;
                Bounds = Screen.FromControl(this).Bounds;
                _isFullscreen = true;
            }
            else
            {
                FormBorderStyle = _prevBorderStyle;
                WindowState = _prevWindowState;
                Bounds = _prevBounds;
                _isFullscreen = false;
            }
        }

        private static Icon CreateMinimalIcon()
        {
            using (var bmp = new Bitmap(64, 64))
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Color.FromArgb(245, 247, 250));

                using (var blueBrush = new SolidBrush(Color.FromArgb(0, 174, 239)))
                {
                    g.FillPolygon(blueBrush, new[]
                    {
                        new PointF(24, 8),
                        new PointF(44, 42),
                        new PointF(4, 42)
                    });
                }

                using (var pinkBrush = new SolidBrush(Color.FromArgb(236, 0, 140)))
                using (var borderPen = new Pen(Color.FromArgb(245, 247, 250), 3f))
                {
                    var rect = new RectangleF(26, 22, 32, 32);
                    g.FillRectangle(pinkBrush, rect);
                    g.DrawRectangle(borderPen, rect.X, rect.Y, rect.Width, rect.Height);
                }

                IntPtr hIcon = bmp.GetHicon();
                return Icon.FromHandle(hIcon);
            }
        }
    }
}
