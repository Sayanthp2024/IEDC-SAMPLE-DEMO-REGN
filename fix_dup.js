const fs = require('fs');
let lines = fs.readFileSync('app.js', 'utf8').split('\n');

// Find the start of the duplicate block
let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// CREATE EVENT MODAL') && i > 500) {
    start = i - 1;
    break;
  }
}

if (start !== -1) {
  // Find the end of the duplicate block
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].includes("btn.disabled = false; btn.textContent = 'Create Event';")) {
      end = i + 2; // include the }); and newline
      break;
    }
  }
  
  if (end !== -1) {
    lines.splice(start, end - start);
    
    // Add open button
    for(let i=0; i<lines.length; i++){
       if (lines[i].includes("<button class=\"action-btn link-btn\" onclick=\"copyLink('${ev.id}')\">🔗 Copy Link</button>")) {
           lines[i] = "            <button class=\"action-btn link-btn\" onclick=\"openLink('${ev.id}')\">↗️ Open</button>\n            <button class=\"action-btn link-btn\" onclick=\"copyLink('${ev.id}')\">🔗 Copy</button>";
       }
       if (lines[i].includes("function copyLink(eventId) {")) {
           lines.splice(i, 0, `function openLink(eventId) {
  const base = window.location.href.replace(/\\/[^/]*(\\?.*)?$/, '').replace(/index\\.html$/, '');
  const url  = \`\${base}/register.html?id=\${eventId}\`;
  window.open(url, '_blank');
}
`);
           break;
       }
    }

    fs.writeFileSync('app.js', lines.join('\n'));
    console.log('Fixed successfully');
  } else {
    console.log('End of duplicate block not found');
  }
} else {
  console.log('Duplicate block not found');
}
