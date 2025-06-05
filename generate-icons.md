# PWA Icon Generation Guide

## Required Icons for Google Play Store PWA

Your PWA needs the following icon sizes in the `public/icons/` directory:

### Core Icons (Required):
- `icon-16x16.png` - Browser favicon
- `icon-32x32.png` - Browser favicon
- `icon-72x72.png` - Android small
- `icon-96x96.png` - Android medium
- `icon-128x128.png` - Android large
- `icon-144x144.png` - Android XL
- `icon-152x152.png` - iOS medium
- `icon-180x180.png` - iOS large
- `icon-192x192.png` - Android standard
- `icon-384x384.png` - Android extra large
- `icon-512x512.png` - Android maximum (Required for Play Store)

### Additional iOS Icons:
- `icon-57x57.png`
- `icon-60x60.png`
- `icon-76x76.png`
- `icon-114x114.png`
- `icon-120x120.png`

### Microsoft Tiles:
- `icon-70x70.png`
- `icon-150x150.png`
- `icon-310x150.png` (wide)
- `icon-310x310.png`

### Additional Assets:
- `og-image.png` (1200x630) - Social sharing
- `search-shortcut.png` (96x96) - App shortcuts
- `add-shortcut.png` (96x96) - App shortcuts
- `dashboard-shortcut.png` (96x96) - App shortcuts

## Design Guidelines:

1. **Base Design**: Use the S N Homes logo with house icon
2. **Colors**: 
   - Primary: #059669 (Emerald 600)
   - Secondary: #ffffff (White)
   - Background: Can be transparent or white
3. **Style**: Modern, clean, recognizable at small sizes
4. **Format**: PNG with transparency where appropriate

## Tools for Icon Generation:

### Online Tools:
1. **PWA Builder** (Microsoft): https://www.pwabuilder.com/imageGenerator
2. **Favicon.io**: https://favicon.io/favicon-generator/
3. **Real Favicon Generator**: https://realfavicongenerator.net/

### Manual Generation:
1. Create a high-quality 1024x1024 master icon
2. Use image editing software to resize to each required size
3. Ensure crisp edges and readable text at small sizes

## Quick Generation Script:

If you have ImageMagick installed, you can use this script to generate all sizes from a master 1024x1024 image:

```bash
# Place your master icon as 'master-icon.png' (1024x1024)

# Generate all required sizes
magick master-icon.png -resize 16x16 public/icons/icon-16x16.png
magick master-icon.png -resize 32x32 public/icons/icon-32x32.png
magick master-icon.png -resize 72x72 public/icons/icon-72x72.png
magick master-icon.png -resize 96x96 public/icons/icon-96x96.png
magick master-icon.png -resize 128x128 public/icons/icon-128x128.png
magick master-icon.png -resize 144x144 public/icons/icon-144x144.png
magick master-icon.png -resize 152x152 public/icons/icon-152x152.png
magick master-icon.png -resize 180x180 public/icons/icon-180x180.png
magick master-icon.png -resize 192x192 public/icons/icon-192x192.png
magick master-icon.png -resize 384x384 public/icons/icon-384x384.png
magick master-icon.png -resize 512x512 public/icons/icon-512x512.png

# iOS specific
magick master-icon.png -resize 57x57 public/icons/icon-57x57.png
magick master-icon.png -resize 60x60 public/icons/icon-60x60.png
magick master-icon.png -resize 76x76 public/icons/icon-76x76.png
magick master-icon.png -resize 114x114 public/icons/icon-114x114.png
magick master-icon.png -resize 120x120 public/icons/icon-120x120.png

# Microsoft tiles
magick master-icon.png -resize 70x70 public/icons/icon-70x70.png
magick master-icon.png -resize 150x150 public/icons/icon-150x150.png
magick master-icon.png -resize 310x310 public/icons/icon-310x310.png
magick master-icon.png -resize 310x150 public/icons/icon-310x150.png
```

## Next Steps:

1. Create and place all icons in `public/icons/`
2. Test the PWA on multiple devices
3. Run Lighthouse audit for PWA compliance
4. Prepare for Google Play Store submission 