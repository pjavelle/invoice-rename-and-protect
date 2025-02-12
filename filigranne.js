const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

const watermarkFile = path.join(__dirname, 'watermark.png');

async function addPngWatermark(inputFile, outputFile) {
    try {
        // Vérifier que le watermark existe
        if (!fs.existsSync(watermarkFile)) {
            throw new Error('Le fichier watermark.png est manquant');
        }

        const pdfBytes = fs.readFileSync(inputFile);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        const pngBytes = fs.readFileSync(watermarkFile);
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
        console.log(`Watermark ajouté: ${outputFile}`);
    } catch (error) {
        console.error('Erreur lors de l\'ajout du watermark:', error);
        throw error;
    }
}
async function convertPDFToImages(pdfPath, outputDir) {
    try {
        // Créer le dossier de sortie s'il n'existe pas
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Utiliser pdftoppm pour convertir toutes les pages en une fois
        // -jpeg : format de sortie
        // -r 150 : résolution 150 DPI
        // -q : qualité (défaut est bon)
        const baseFileName = path.join(outputDir, 'page');
        const cmd = `pdftoppm -jpeg -r 150 "${pdfPath}" "${baseFileName}"`;

        console.log('Conversion en cours...');

        try {
            await execPromise(cmd);

            // Vérifier les fichiers créés
            const files = fs.readdirSync(outputDir);
            const jpegFiles = files.filter(f => f.endsWith('.jpg'));

            // Renommer les fichiers pour avoir un format cohérent
            // pdftoppm crée des fichiers comme "page-1.jpg", "page-2.jpg", etc.
            jpegFiles.sort().forEach((file, index) => {
                const oldPath = path.join(outputDir, file);
                const newPath = path.join(outputDir, `page_${index + 1}.jpg`);
                fs.renameSync(oldPath, newPath);

                const stats = fs.statSync(newPath);
                console.log(`Page ${index + 1} sauvegardée: ${newPath} (${(stats.size / 1024).toFixed(2)} KB)`);
            });

            console.log(`\nConversion terminée! ${jpegFiles.length} pages converties.`);
            console.log(`Images sauvegardées dans: ${outputDir}`);
        } catch (error) {
            console.error('Erreur lors de la conversion:', error);
            if (error.message.includes('command not found')) {
                console.error('\nIl semble que pdftoppm ne soit pas installé.');
                console.error('Pour l\'installer sur macOS:');
                console.error('1. Installer Homebrew si ce n\'est pas déjà fait (https://brew.sh)');
                console.error('2. Exécuter: brew install poppler');
            }
            throw error;
        }
    } catch (error) {
        console.error(`Erreur lors de la conversion de ${pdfPath}:`, error);
        throw error;
    }
}

async function convertImagesToPDF(imagesDir, outputPath) {
    try {
        // Vérifier que le dossier d'images existe
        if (!fs.existsSync(imagesDir)) {
            throw new Error(`Le répertoire ${imagesDir} n'existe pas`);
        }

        // Lire les images du dossier
        const files = fs.readdirSync(imagesDir);
        const imageFiles = files
            .filter(f => f.endsWith('.jpg'))
            .sort((a, b) => {
                // Trier les fichiers numériquement (page_1.jpg, page_2.jpg, etc.)
                const numA = parseInt(a.match(/\d+/)[0]);
                const numB = parseInt(b.match(/\d+/)[0]);
                return numA - numB;
            });

        if (imageFiles.length === 0) {
            throw new Error('Aucune image JPG trouvée dans le dossier');
        }

        // Créer un nouveau document PDF
        const pdfDoc = await PDFDocument.create();

        // Ajouter chaque image comme une nouvelle page
        for (const imageFile of imageFiles) {
            const imagePath = path.join(imagesDir, imageFile);
            
            // Convertir l'image en PNG (pdf-lib supporte mieux le PNG)
            const imageBuffer = await sharp(imagePath)
                .png()
                .toBuffer();

            // Incorporer l'image dans le PDF
            const image = await pdfDoc.embedPng(imageBuffer);
            
            // Créer une nouvelle page avec les dimensions de l'image
            const page = pdfDoc.addPage([image.width, image.height]);
            
            // Dessiner l'image sur la page
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
        }

        // Créer le dossier de sortie s'il n'existe pas
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Sauvegarder le PDF
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);
        
        console.log(`PDF créé avec succès: ${outputPath}`);
    } catch (error) {
        console.error('Erreur lors de la conversion en PDF:', error);
        throw error;
    }
}

async function processImagesDirectories() {
    try {
        const baseDir = '3-pdf-to-images';
        const outputDir = '4-export';

        // Vérifier que le répertoire source existe
        if (!fs.existsSync(baseDir)) {
            console.log('Aucun dossier d\'images à traiter');
            return;
        }

        // Créer le dossier de sortie s'il n'existe pas
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Lire tous les dossiers d'images
        const directories = fs.readdirSync(baseDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        if (directories.length === 0) {
            console.log('Aucun dossier d\'images trouvé');
            return;
        }

        console.log(`Trouvé ${directories.length} dossiers d'images à convertir`);

        // Traiter chaque dossier
        for (const dir of directories) {
            const imagesDir = path.join(baseDir, dir);
            const outputName = dir.replace('_images', '');
            const outputPath = path.join(outputDir, `${outputName}.pdf`);

            console.log(`\nConversion du dossier ${dir}...`);
            await convertImagesToPDF(imagesDir, outputPath);
        }

        console.log('\nToutes les conversions sont terminées !');
    } catch (error) {
        console.error('Erreur lors du traitement des dossiers d\'images:', error);
    }
}

async function processDirectory(inputDir) {
    try {
        // Créer les dossiers nécessaires s'ils n'existent pas
        ['./2-watermarks', './3-pdf-to-images', './4-export'].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Vérifier que le répertoire d'entrée existe
        if (!fs.existsSync(inputDir)) {
            throw new Error(`Le répertoire ${inputDir} n'existe pas`);
        }

        // Lire le contenu du répertoire
        const files = fs.readdirSync(inputDir);
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

        if (pdfFiles.length === 0) {
            console.log('Aucun fichier PDF trouvé dans le répertoire');
            return;
        }

        console.log(`Trouvé ${pdfFiles.length} fichiers PDF`);

        // Traiter chaque fichier PDF
        for (const pdfFile of pdfFiles) {
            console.log(`\nTraitement de ${pdfFile}...`);

            // 1. Ajouter le watermark
            const inputPath = path.join(inputDir, pdfFile);
            const watermarkPath = path.join('./2-watermarks', pdfFile);
            console.log('Ajout du watermark...');
            await addPngWatermark(inputPath, watermarkPath);

            // 2. Convertir en images
            const outputDir = path.join('./3-pdf-to-images', path.basename(pdfFile, '.pdf') + '_images');
            console.log('Conversion en images...');
            await convertPDFToImages(watermarkPath, outputDir);
        }

        // 3. Convertir tous les dossiers d'images en PDF
        console.log('\nConversion des dossiers d\'images en PDF...');
        await processImagesDirectories();

        console.log('\nTraitement terminé !');
    } catch (error) {
        console.error('Erreur lors du traitement du répertoire:', error);
    }
}

// Point d'entrée du script
const inputDirectory = './1-pdfs';  // Dossier contenant les PDF originaux
processDirectory(inputDirectory);