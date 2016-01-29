#Receipt / Bill / Scanned Documents / PDF extractor

####A simple, hand-engineered data extraction tool using pdftotext, tesseract, and image magick.

#####Install:
- Install node, npm, tesseract, pdftotext, and imagemagick binaries
- clone repo, npm install
- Run with: `node index.js FILENAME` (where filename is path to a pdf or image file)

#####Notes:
- For non-images, (html, word, etc), convert the doc to pdf using LibreOffice, and then use the pdf with this script
