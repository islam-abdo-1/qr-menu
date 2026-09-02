const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Add import if not present and console.error is used
  if (content.includes('console.error(') && !content.includes("from '@/lib/logger'")) {
    // Find the last import line
    const importRegex = /^import .+ from ['"].+['"];?$/gm;
    let lastImportMatch = null;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      lastImportMatch = match;
    }
    if (lastImportMatch) {
      const insertPos = lastImportMatch.index + lastImportMatch[0].length;
      content = content.slice(0, insertPos) + "\nimport logger from '@/lib/logger';";
    }
  }
  
  // Replace console.error with logger.error
  content = content.replace(/console\.error\(/g, 'logger.error(');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', filePath);
    return true;
  }
  return false;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir('lib');
walkDir('app/api');