using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Text;
using System.Windows.Forms;
using System.Diagnostics;
using System.Threading;

namespace AppLauncher
{
    class Program
    {
        private static string dataFile = "apps.txt";
        private static string wwwDir = "www";
        private static string logFile = "log.txt";
        private static int port = 5050;

        private static void Log(string msg)
        {
            try {
                string entry = "[" + DateTime.Now.ToString("HH:mm:ss") + "] " + msg + Environment.NewLine;
                File.AppendAllText(logFile, entry);
                Console.WriteLine(msg);
            } catch {}
        }

        [STAThread]
        static void Main(string[] args)
        {
            // Selbst-Heilung: Alte Instanzen beenden
            try {
                Process current = Process.GetCurrentProcess();
                foreach (Process p in Process.GetProcessesByName(current.ProcessName)) {
                    if (p.Id != current.Id) {
                        p.Kill();
                        p.WaitForExit(1000);
                    }
                }
            } catch {}

            // Moderne TLS 1.2 Verschlüsselung aktivieren für HTTPS Anfragen (z.B. Steam API)
            try {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // Tls12
            } catch {}

            Log("App gestartet.");
            if (!Directory.Exists(wwwDir)) Directory.CreateDirectory(wwwDir);
            
            HttpListener listener = new HttpListener();
            try {
                // Versuche beide Prefixes
                listener.Prefixes.Add("http://localhost:" + port + "/");
                listener.Prefixes.Add("http://127.0.0.1:" + port + "/");
            } catch (Exception ex) {
                Log("Prefix Fehler: " + ex.Message);
            }
            
            try
            {
                Log("Starte Listener auf Port " + port + "...");
                listener.Start();
                Log("Server läuft!");
                
                // Versuche die App als "richtiges Fenster" (App Mode) zu öffnen
                bool launched = false;
                try {
                    // Microsoft Edge App Mode (Chromium basiert, unterstützt alle Effekte)
                    Process.Start("msedge.exe", "--app=http://127.0.0.1:" + port + "/");
                    launched = true;
                } catch {
                    try {
                        // Chrome Fallback
                        Process.Start("chrome.exe", "--app=http://127.0.0.1:" + port + "/");
                        launched = true;
                    } catch {
                        // Letzter Fallback: Standard Browser
                        Process.Start("http://127.0.0.1:" + port + "/");
                    }
                }

                if (launched) Log("Browser im App-Modus gestartet.");

                while (listener.IsListening)
                {
                    HttpListenerContext context = listener.GetContext();
                    ThreadPool.QueueUserWorkItem((c) => HandleRequest((HttpListenerContext)c), context);
                }
            }
            catch (Exception ex)
            {
                Log("CRASH: " + ex.Message);
                MessageBox.Show("Server-Fehler: " + ex.Message + "\nDetails im log.txt", "Launcher Fehler", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        static void HandleRequest(HttpListenerContext context)
        {
            HttpListenerRequest request = context.Request;
            HttpListenerResponse response = context.Response;
            string url = request.Url.AbsolutePath;
            Log("Request: " + request.HttpMethod + " " + url);

            try
            {
                if (url == "/" || url == "/index.html")
                {
                    Console.WriteLine("Serving Layout...");
                    ServeFile(response, Path.Combine(wwwDir, "index.html"), "text/html");
                }
                else if (url == "/api/apps" && request.HttpMethod == "GET")
                {
                    Console.WriteLine("API: Get Apps");
                    string json = GetAppsJson();
                    SendResponse(response, json, "application/json");
                }
                else if (url == "/api/apps" && request.HttpMethod == "DELETE")
                {
                    Console.WriteLine("API: Delete App");
                    string path = request.QueryString["path"];
                    DeleteApp(path);
                    SendResponse(response, "{\"status\":\"ok\"}", "application/json");
                }
                else if (url == "/api/add" && request.HttpMethod == "POST")
                {
                    Console.WriteLine("API: Add App Triggered...");
                    string result = ShowAddDialog();
                    SendResponse(response, result, "application/json");
                }
                else if (url == "/api/launch" && request.HttpMethod == "POST")
                {
                    string path = request.QueryString["path"];
                    Console.WriteLine("API: Launching " + path);
                    LaunchApp(path);
                    SendResponse(response, "{\"status\":\"ok\"}", "application/json");
                }
                else if (url == "/api/icon" && request.HttpMethod == "GET")
                {
                    string path = request.QueryString["path"];
                    // Console.WriteLine("API: Icon " + path); // Too much noise
                    ServeIcon(response, path);
                }
                else if (url == "/api/proxy" && request.HttpMethod == "GET")
                {
                    string targetUrl = request.QueryString["url"];
                    Log("Proxy Request: " + targetUrl);
                    if (targetUrl.Contains("steampowered.com") || targetUrl.Contains("steamstatic.com"))
                    {
                        try {
                            using (WebClient client = new WebClient())
                            {
                                client.Encoding = Encoding.UTF8;
                                // Steam blockt oft Anfragen ohne User-Agent
                                client.Headers.Add("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
                                byte[] data = client.DownloadData(targetUrl);
                                response.ContentType = "application/json";
                                response.ContentLength64 = data.Length;
                                response.OutputStream.Write(data, 0, data.Length);
                            }
                        } catch (Exception ex) {
                            Log("Proxy Error details: " + ex.Message);
                            response.StatusCode = 500;
                        }
                        response.Close();
                    }
                    else
                    {
                        response.StatusCode = 403;
                        response.Close();
                    }
                }
                else
                {
                    response.StatusCode = 404;
                    response.Close();
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                byte[] buffer = Encoding.UTF8.GetBytes(ex.Message);
                response.OutputStream.Write(buffer, 0, buffer.Length);
                response.Close();
            }
        }

        static void ServeFile(HttpListenerResponse response, string path, string contentType)
        {
            if (File.Exists(path))
            {
                byte[] buffer = File.ReadAllBytes(path);
                response.ContentType = contentType;
                response.ContentLength64 = buffer.Length;
                response.OutputStream.Write(buffer, 0, buffer.Length);
            }
            else
            {
                response.StatusCode = 404;
            }
            response.Close();
        }

        static void SendResponse(HttpListenerResponse response, string content, string contentType)
        {
            byte[] buffer = Encoding.UTF8.GetBytes(content);
            response.ContentType = contentType;
            response.ContentLength64 = buffer.Length;
            response.OutputStream.Write(buffer, 0, buffer.Length);
            response.Close();
        }

        static string GetAppsJson()
        {
            List<string> jsonItems = new List<string>();
            if (File.Exists(dataFile))
            {
                foreach (string line in File.ReadAllLines(dataFile))
                {
                    string[] parts = line.Split('|');
                    if (parts.Length == 2)
                    {
                        // Minimalistisches JSON-Encoding
                        jsonItems.Add("{\"Name\":\"" + parts[0].Replace("\\", "\\\\").Replace("\"", "\\\"") + "\",\"Path\":\"" + parts[1].Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"}");
                    }
                }
            }
            return "[" + string.Join(",", jsonItems.ToArray()) + "]";
        }

        static string ShowAddDialog()
        {
            string jsonResult = "{\"status\":\"cancelled\"}";
            
            // Da wir im Server-Thread sind, müssen wir den Dialog im STA-Thread ausführen
            Thread t = new Thread(() =>
            {
                using (OpenFileDialog ofd = new OpenFileDialog())
                {
                    ofd.Filter = "Exe Dateien (*.exe)|*.exe|Alle Dateien (*.*)|*.*";
                    if (ofd.ShowDialog() == DialogResult.OK)
                    {
                        string path = ofd.FileName;
                        string name = Path.GetFileNameWithoutExtension(path);
                        File.AppendAllText(dataFile, name + "|" + path + Environment.NewLine);
                        jsonResult = "{\"status\":\"ok\",\"path\":\"" + path.Replace("\\", "\\\\") + "\"}";
                    }
                }
            });
            t.SetApartmentState(ApartmentState.STA);
            t.Start();
            t.Join(); // Warten bis Dialog fertig ist
            
            return jsonResult;
        }

        static void LaunchApp(string path)
        {
            try {
                ProcessStartInfo startInfo = new ProcessStartInfo(path);
                startInfo.WorkingDirectory = Path.GetDirectoryName(path);
                Process.Start(startInfo);
            } catch {}
        }

        static void DeleteApp(string path)
        {
            if (!File.Exists(dataFile)) return;
            List<string> lines = new List<string>(File.ReadAllLines(dataFile));
            List<string> newLines = new List<string>();
            foreach (string line in lines)
            {
                if (!line.Contains("|" + path))
                {
                    newLines.Add(line);
                }
            }
            File.WriteAllLines(dataFile, newLines.ToArray());
        }

        static void ServeIcon(HttpListenerResponse response, string path)
        {
            try
            {
                if (string.IsNullOrEmpty(path) || !File.Exists(path))
                {
                    response.StatusCode = 404;
                    response.Close();
                    return;
                }

                using (Icon icon = Icon.ExtractAssociatedIcon(path))
                {
                    using (Bitmap bmp = icon.ToBitmap())
                    {
                        using (MemoryStream ms = new MemoryStream())
                        {
                            bmp.Save(ms, ImageFormat.Png);
                            byte[] buffer = ms.ToArray();
                            response.ContentType = "image/png";
                            response.ContentLength64 = buffer.Length;
                            response.OutputStream.Write(buffer, 0, buffer.Length);
                        }
                    }
                }
            }
            catch
            {
                response.StatusCode = 500;
            }
            response.Close();
        }
    }
}
