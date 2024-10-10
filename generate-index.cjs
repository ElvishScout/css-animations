const fs = require("node:fs");
const path = require("node:path");

const ejs = require("ejs");

const homeDir = process.env.HOME_DIR ?? __dirname;

const templatePath = path.join(homeDir, "template.ejs");
const animationsDir = path.join(homeDir, "animations/");
const outputPath = path.join(homeDir, "index.html");

function generateIndex() {
  const template = ejs.compile(fs.readFileSync(templatePath).toString());

  const animations = fs.readdirSync(animationsDir).map((file) => {
    const fileText = fs.readFileSync(path.join(animationsDir, file)).toString().replace(/\r/g, "");

    const name = /^(.*)\./.exec(file)?.[1] || "";
    const style = /<style.*?<\/style>/is.exec(fileText)?.[0] || "";
    const div = /<div.*<\/div>/is.exec(fileText)?.[0] || "";
    const source = fileText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .split("\n")
      .map((line) => `<code>${line}</code>`)
      .join("\n");

    return { name, style, div, source };
  });

  return template({ animations });
}

if (require.main === module) {
  fs.writeFileSync(outputPath, generateIndex());
  console.log(`Saved to ${outputPath}`);
}

module.exports = { generateIndex };
