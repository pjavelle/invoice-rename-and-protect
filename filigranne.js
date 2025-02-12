const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function addPngWatermark(inputFile, outputFile, pngFile) {
    const pdfBytes = fs.readFileSync(inputFile);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pngBytes = fs.readFileSync(pngFile);
    const pngImage = await pdfDoc.embedPng(pngBytes);

    const pages = pdfDoc.getPages();
    pages.forEach(page => {
        const { width, height } = page.getSize();
        const pngDims = pngImage.scale(0.5);

        page.drawImage(pngImage, {
            x: (width - pngDims.width) / 2,
            y: (height - pngDims.height) / 2,
            width: pngDims.width,
            height: pngDims.height,
            opacity: 0.2
        });
    });

    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputFile, modifiedPdfBytes);
}

(async () => {
    const directoryPath = path.join(__dirname, 'pdfs');
    const directoryOutputPath = path.join(__dirname, 'watermarks');
    const files = fs.readdirSync(directoryPath).filter(file => file.endsWith('.pdf'));
    const watermarkFile = path.join(__dirname, 'watermark.png');

    for (const file of files) {
        const inputFile = path.join(directoryPath, file);
        const outputFileName = file.replace(/\.pdf$/, '-watermarked.pdf');
        const outputFile = path.join(directoryOutputPath, outputFileName);

        await addPngWatermark(inputFile, outputFile, watermarkFile);
        console.log(`Filigrane ajouté à toutes les pages de : ${file}`);
    }
})();
