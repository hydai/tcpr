Icon Files Required for Application Build
==========================================

Please place the following icon files in this directory:

1. icon.ico (Windows icon, 256x256)
   - This is used for the Windows executable

2. icon.icns (macOS icon, 512x512 or 1024x1024)
   - This is used for the macOS application bundle
   - Must be in Apple's .icns format

3. icon.png (PNG icon, 512x512)
   - This is used for the application window on all platforms

You can create these icons from the Twitch logo or a custom design.

Recommended tools for creating icons:
- Windows (.ico): https://icoconvert.com/
- macOS (.icns):
  * iconutil (macOS built-in): Create an iconset folder with multiple PNG sizes
  * Online: https://cloudconvert.com/png-to-icns
  * Desktop: Image2Icon (Mac App Store)
- Desktop editors: GIMP, Photoshop, or Inkscape

Twitch Brand Resources:
- https://brand.twitch.tv/

The icons should feature the Twitch purple (#9147FF) and be recognizable
as related to Twitch Channel Points monitoring.

macOS Icon Size Requirements:
If using iconutil, create an iconset with these sizes:
- icon_16x16.png
- icon_32x32.png
- icon_128x128.png
- icon_256x256.png
- icon_512x512.png
- icon_512x512@2x.png (1024x1024)

Then run: iconutil -c icns icon.iconset

Until you add custom icons, the application will use default Electron icons.
