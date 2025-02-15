const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

const watermarkFile = path.join(__dirname, 'watermark.png');

/* Fonctions de log avec couleurs et emoji */
function logError(msg) {
  console.error(`\x1b[31m❌ [Erreur] ${msg}\x1b[0m`);
}
function logWarning(msg) {
  console.log(`\x1b[33m🟡 [Info] ${msg}\x1b[0m`);
}
function logInfo(msg) {
  console.log(`\x1b[34m🔵 [Info] ${msg}\x1b[0m`);
}
function logSuccess(msg) {
  console.log(`\x1b[32m🟢 [Succès] ${msg}\x1b[0m`);
}

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
                opacity: 0.18
            });
        });

        const modifiedPdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputFile, modifiedPdfBytes);
        logSuccess(`Watermark ajouté: ${outputFile}`);
    } catch (error) {
        logError(`Erreur lors de l'ajout du watermark: ${error.message || error}`);
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
        const cmd = `pdftoppm -jpeg -r 100 "${pdfPath}" "${baseFileName}"`;

        logInfo('Conversion en cours...');

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
                logWarning(`Page ${index + 1} sauvegardée: ${newPath} (${(stats.size / 1024).toFixed(2)} KB)`);
            });

            logSuccess(`Conversion terminée! ${jpegFiles.length} pages converties.`);
            logSuccess(`Images sauvegardées dans: ${outputDir}`);
        } catch (error) {
            logError(`Erreur lors de la conversion: ${error.message || error}`);
            if (error.message && error.message.includes('command not found')) {
                logError('Il semble que pdftoppm ne soit pas installé.');
                logError('Pour l\'installer sur macOS:');
                logError('1. Installer Homebrew si ce n\'est pas déjà fait (https://brew.sh)');
                logError('2. Exécuter: brew install poppler');
            }
            throw error;
        }
    } catch (error) {
        logError(`Erreur lors de la conversion de ${pdfPath}: ${error.message || error}`);
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
                .jpeg({ quality: 20, chromaSubsampling: '4:2:0' })
                .png({
                    compressionLevel: 9,
                    quality: 20,
                    adaptiveFiltering: true,
                    force: true
                })
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
        
        logSuccess(`PDF créé avec succès: ${outputPath}`);
    } catch (error) {
        logError(`Erreur lors de la conversion en PDF: ${error.message || error}`);
        throw error;
    }
}

async function processImagesDirectories() {
    try {
        const baseDir = '3-pdf-to-images';
        const outputDir = '4-export';

        // Vérifier que le répertoire source existe
        if (!fs.existsSync(baseDir)) {
            logWarning('Aucun dossier d\'images à traiter');
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
            logWarning('Aucun dossier d\'images trouvé');
            return;
        }

        logInfo(`Trouvé ${directories.length} dossiers d'images à convertir`);

        // Traiter chaque dossier
        for (const dir of directories) {
            const imagesDir = path.join(baseDir, dir);
            const outputName = dir.replace('_images', '');
            const outputPath = path.join(outputDir, `${outputName}.pdf`);

            logInfo(`Conversion du dossier ${dir}...`);
            await convertImagesToPDF(imagesDir, outputPath);
        }

        logSuccess('Toutes les conversions sont terminées !');
    } catch (error) {
        logError(`Erreur lors du traitement des dossiers d'images: ${error.message || error}`);
    }
}

async function processDirectory(inputDir) {
    try {
        // Créer ou vider les dossiers nécessaires
        const dirs = ['./2-watermarks', './3-pdf-to-images', './4-export'];
        dirs.forEach(dir => {
            // Pour le dossier "3-pdf-to-images", on supprime son contenu s'il existe.
            if (dir === './3-pdf-to-images' && fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
            fs.mkdirSync(dir, { recursive: true });
        });

        // Vérifier que le répertoire d'entrée existe
        if (!fs.existsSync(inputDir)) {
            throw new Error(`Le répertoire ${inputDir} n'existe pas`);
        }

        // Lire le contenu du répertoire
        const files = fs.readdirSync(inputDir);
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

        if (pdfFiles.length === 0) {
            logWarning('Aucun fichier PDF trouvé dans le répertoire');
            return;
        }

        logInfo(`Trouvé ${pdfFiles.length} fichiers PDF`);

        // Traiter chaque fichier PDF
        for (const pdfFile of pdfFiles) {
            logInfo(`\nTraitement de ${pdfFile}...`);

            // 1. Ajouter le watermark
            const inputPath = path.join(inputDir, pdfFile);
            const watermarkPath = path.join('./2-watermarks', pdfFile);
            logInfo('Ajout du watermark...');
            await addPngWatermark(inputPath, watermarkPath);

            // 2. Convertir en images
            const outputDir = path.join('./3-pdf-to-images', path.basename(pdfFile, '.pdf') + '_images');
            logInfo('Conversion en images...');
            await convertPDFToImages(watermarkPath, outputDir);
        }

        // 3. Convertir tous les dossiers d'images en PDF
        logInfo('Conversion des dossiers d\'images en PDF...');
        await processImagesDirectories();

        logSuccess('Traitement terminé !');
    } catch (error) {
        logError(`Erreur lors du traitement du répertoire: ${error.message || error}`);
    }
}

// Point d'entrée du script
const inputDirectory = './1-pdfs';  // Dossier contenant les PDF originaux
processDirectory(inputDirectory);