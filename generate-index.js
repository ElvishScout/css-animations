const fs = require("node:fs");
const path = require("node:path");
const ejs = require("ejs");

const configPath = process.env.CONFIG_PATH || "config.json";

function generateIndex({ config, injectedScript } = {}) {
  const templatePath = path.join(__dirname, config.templatePath);
  const animationsDir = path.join(__dirname, config.animationsDir);

  const template = ejs.compile(fs.readFileSync(templatePath).toString());
  const animations = fs.readdirSync(animationsDir).map((file) => {
    const source = fs.readFileSync(path.join(animationsDir, file)).toString().replace(/\r/g, "");
    const name = (/^(.*)\./.exec(file)?.[1] || "").replace(/_/g, " ");
    const style = /<style.*?<\/style>/is.exec(source)?.[0] || "";
    const div = /<div.*<\/div>/is.exec(source)?.[0] || "";

    return { name, style, div, source };
  });

  return template({ animations, injectedScript });
}

if (require.main === module) {
  const config = JSON.parse(fs.readFileSync(configPath).toString());
  const indexPath = path.join(config.outputDir, "index.html");
  fs.mkdirSync(config.outputDir, { recursive: true });
  fs.writeFileSync(indexPath, generateIndex({ config }));
}

module.exports = { generateIndex };
