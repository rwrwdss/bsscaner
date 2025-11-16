const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning development artifacts before build...');

// Удаляем только артефакты разработки (НИ В КОЕМ СЛУЧАЕ НЕ пользовательские данные приложения!)
// Примечание: пользовательские данные хранятся в отдельной папке приложения (~/Library/Application Support/BSscaner/bsscaner_data/)
// Эти файлы удаляем только если они есть в папке проекта (артефакты разработки)

const cleanupFiles = [
    'user-data',  // Только если это артефакт в папке проекта
    '.user-session',  // Только если это артефакт в папке проекта
    'localStorage.json'  // Только если это артефакт в папке проекта
];

cleanupFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Removed development artifact: ${file}`);
    }
});

// Очищаем директорию dist если есть
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
    console.log('✅ Cleaned: dist directory');
}

console.log('✨ Ready for production build!');

