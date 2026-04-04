using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

class IconConverter {
    static void Main() {
        try {
            using (Bitmap bmp = new Bitmap("www/icon.png")) {
                using (Bitmap iconBmp = new Bitmap(bmp, 256, 256)) {
                    IntPtr hIcon = iconBmp.GetHicon();
                    using (Icon icon = Icon.FromHandle(hIcon)) {
                        using (FileStream fs = new FileStream("icon.ico", FileMode.Create)) {
                            icon.Save(fs);
                        }
                    }
                }
            }
            Console.WriteLine("Success");
        } catch (Exception ex) {
            Console.WriteLine("Error: " + ex.Message);
        }
    }
}
