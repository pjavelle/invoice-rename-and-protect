const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

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

async function processDirectory(inputDir) {
    try {
        // Vérifier que le répertoire d'entrée existe
        if (!fs.existsSync(inputDir)) {
            throw new Error(`Le répertoire ${inputDir} n'existe pas`);
        }

        // Lire le contenu du répertoire
        const files = fs.readdirSync(inputDir);

        // Filtrer pour ne garder que les fichiers PDF
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

        if (pdfFiles.length === 0) {
            console.log('Aucun fichier PDF trouvé dans le répertoire');
            return;
        }

        console.log(`Trouvé ${pdfFiles.length} fichiers PDF`);

        // Traiter chaque fichier PDF
        for (const pdfFile of pdfFiles) {
            const pdfPath = path.join(inputDir, pdfFile);
            const outputDir = path.join('3-pdf-to-images', path.basename(pdfFile, '.pdf') + '_images');

            console.log(`\nTraitement de ${pdfFile}...`);
            await convertPDFToImages(pdfPath, outputDir);
        }

        console.log('\nTraitement terminé !');
    } catch (error) {
        console.error('Erreur lors du traitement du répertoire:', error);
    }
}

// Utilisation du script
const inputDirectory = './2-watermarks'; // Modifier selon vos besoins
processDirectory(inputDirectory);