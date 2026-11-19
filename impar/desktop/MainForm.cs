using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ImparDesktop
{
    public sealed class MainForm : Form
    {
        private readonly WebView2 _webView;
        private bool _isFullscreen;
        private FormBorderStyle _prevBorderStyle;
        private FormWindowState _prevWindowState;
        private Rectangle _prevBounds;

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        public MainForm()
        {
            try { SetProcessDPIAware(); } catch { }

            Text = "ÍMPAR — Jogo de Mesa 3D";
            Width = 1400;
            Height = 880;
            MinimumSize = new Size(1024, 680);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(9, 13, 20);
            Icon = CreateImparIcon();
            KeyPreview = true;

            EnableDarkTitleBar();

            _webView = new WebView2();
            _webView.Dock = DockStyle.Fill;
            _webView.DefaultBackgroundColor = Color.FromArgb(9, 13, 20);
            Controls.Add(_webView);

            Load += OnFormLoad;
            KeyDown += OnMainKeyDown;
        }

        private async void OnFormLoad(object sender, EventArgs e)
        {
            await InitializeWebViewAsync();
        }

        private void EnableDarkTitleBar()
        {
            try
            {
                int useImmersiveDarkMode = 1;
                DwmSetWindowAttribute(Handle, 20, ref useImmersiveDarkMode, sizeof(int));
            }
            catch
            {
            }
        }

        private async Task InitializeWebViewAsync()
        {
            string userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Impar3D",
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
                "impar.local",
                appDir,
                CoreWebView2HostResourceAccessKind.Allow
            );

            _webView.CoreWebView2.Navigate("https://impar.local/index.html");
        }

        private static string ResolveAppDirectory()
        {
            string nextToExe = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app");
            if (Directory.Exists(nextToExe) && File.Exists(Path.Combine(nextToExe, "index.html")))
                return nextToExe;

            string dir = AppDomain.CurrentDomain.BaseDirectory;
            for (int i = 0; i < 6; i++)
            {
                string candidate = Path.Combine(dir, "app");
                if (Directory.Exists(candidate) && File.Exists(Path.Combine(candidate, "index.html")))
                    return candidate;
                DirectoryInfo parent = Directory.GetParent(dir);
                if (parent == null) break;
                dir = parent.FullName;
            }

            throw new DirectoryNotFoundException("Pasta 'app' do jogo Ímpar não encontrada.");
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

        private static Icon CreateImparIcon()
        {
            using (var bmp = new Bitmap(64, 64))
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Color.FromArgb(9, 13, 20));

                using (var blueBrush = new SolidBrush(Color.FromArgb(0, 174, 239)))
                {
                    g.FillPolygon(blueBrush, new[]
                    {
                        new PointF(24, 6),
                        new PointF(44, 40),
                        new PointF(4, 40)
                    });
                }

                using (var pinkBrush = new SolidBrush(Color.FromArgb(236, 0, 140)))
                using (var borderPen = new Pen(Color.FromArgb(9, 13, 20), 3f))
                {
                    var rect = new RectangleF(26, 22, 32, 32);
                    g.FillRectangle(pinkBrush, rect);
                    g.DrawRectangle(borderPen, rect.X, rect.Y, rect.Width, rect.Height);
                }

                using (var whiteBrush = new SolidBrush(Color.White))
                {
                    g.FillRectangle(whiteBrush, 36, 36, 12, 4);
                }

                IntPtr hIcon = bmp.GetHicon();
                return Icon.FromHandle(hIcon);
            }
        }
    }
}
