const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');
c = c.replace(/ðŸ• /g, '🕐').replace(/ðŸ“ /g, '📍');
c = c.replace(/Link copied! ðŸ”—/g, 'Link copied! 🔗');
c = c.replace(/ðŸŽ‰/g, '🎉');
c = c.replace(/ðŸ”— Copy Link/g, '🔗 Copy Link');
fs.writeFileSync('app.js', c);
