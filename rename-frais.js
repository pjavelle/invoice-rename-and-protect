const fs = require('fs');
const path = require('path');

// Spécifiez le répertoire contenant les fichiers PDF
const directoryPath = './frais/'; // Remplacez par le chemin du répertoire contenant vos fichiers PDF

// Lire le contenu du répertoire
fs.readdir(directoryPath, (err, files) => {
    if (err) {
        return console.log('Erreur lors de la lecture du répertoire:', err);
    }

    // Parcourir la liste des fichiers
    files.forEach((file) => {
        const filePath = path.join(directoryPath, file);

        // Vérifier si le fichier est un PDF
        if (path.extname(file) === '.pdf') {
            // Extraire les parties nécessaires du nom du fichier
            const match = file.match(/.* - (.*) - .* - (FR\d+-\d+)\.pdf$/);

            if (match && match[1] && match[2]) {
                const commission = match[1];
                const code = match[2];
                const newFileName = `${commission}-${code}.pdf`;
                const newFilePath = path.join(directoryPath, newFileName);

                // Renommer le fichier
                fs.rename(filePath, newFilePath, (err) => {
                    if (err) {
                        console.log(`Erreur lors du renommage du fichier ${file}:`, err);
                    } else {
                        console.log(`Le fichier ${file} a été renommé en ${newFileName}`);
                    }
                });
            }
        }
    });
});