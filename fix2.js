const fs = require('fs');
let lines = fs.readFileSync('app.js', 'utf8').split('\n');
lines[510] = "          ${ev.time  ? `<span class=\"meta-item\"><span class=\"meta-icon\">🕐</span>${fmtTime(ev.time)}</span>` : ''}";
lines[511] = "          ${ev.venue ? `<span class=\"meta-item\"><span class=\"meta-icon\">📍</span>${escHtml(ev.venue)}</span>` : ''}";
fs.writeFileSync('app.js', lines.join('\n'));
