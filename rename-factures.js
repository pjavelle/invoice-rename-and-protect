const fs = require('fs');
const path = require('path');

// Spécifiez le répertoire contenant les fichiers PDF
const directoryPath = './factures';

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
            console.log("Nom du fichier lu:", file);  // Ajouté pour le débogage

            // Utiliser une expression régulière pour trouver le motif
            const regex = /(FR\d+TM\d+-\d+)/;
            const match = file.match(regex);

            console.log("Résultat du match:", match);  // Ajouté pour le débogage

            if (match && match[1]) {
                const newFileName = `${match[1]}.pdf`;
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
