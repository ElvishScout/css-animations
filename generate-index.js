const fs = require("node:fs/promises");
const path = require("node:path");
const ejs = require("ejs");
const { minify } = require("html-minifier");

const configPath = process.env.CONFIG_PATH ?? path.join(__dirname, "config.json");

/**
 * @typedef Config
 * @property {string | undefined} template
 * @property {string | undefined} stylesheets
 * @property {string | undefined} animations
 * @property {string | undefined} output
 * @property {string | undefined} github
 */

/** @returns {Promise<Config>} */
const getConfig = async () => {
  try {
    return JSON.parse((await fs.readFile(configPath)).toString());
  } catch {
    return {};
  }
};

/**
 * @template T
 * @param {T} value
 * @returns {T extends undefined | null ? never : T}
 */
const notnull = (value) => {
  if (value === undefined || value === null) {
    throw "value cannot be undefined or null";
  }
  return value;
};

/**
 * @param {string | undefined} injectedScript
 * @returns {Promise<string>}
 */
const generateIndex = async (injectedScript = "") => {
  const config = await getConfig();

  const templatePath = path.join(__dirname, config.template ?? "template.ejs");
  const stylesheetsDir = path.join(__dirname, config.stylesheets ?? "stylesheets");
  const animationsDir = path.join(__dirname, config.animations ?? "animations");
  const github = config.github ?? "";

  const templateContent = (await fs.readFile(templatePath)).toString();
  const template = ejs.compile(templateContent);

  const stylesheets = (
    await Promise.all(
      (
        await fs.readdir(stylesheetsDir)
      )
        .filter((entry) => /\.css$/.test(entry))
        .map(async (entry) => {
          const filename = path.join(stylesheetsDir, entry);
          const content = (await fs.readFile(filename)).toString().replace(/\r/g, "");
          const source = `<style>${content}</style>`;

          const [, _index, _name] = notnull(/^(\d+)_/.exec(entry));
          const index = parseInt(_index);
          return { index, source };
        })
    )
  )
    .sort((a, b) => a.index - b.index)
    .map(({ source }) => source);

  const animations = (
    await Promise.all(
      (
        await fs.readdir(animationsDir)
      )
        .filter((entry) => /\.html$/.test(entry))
        .map(async (entry) => {
          const filename = path.join(animationsDir, entry);
          const source = (await fs.readFile(filename)).toString().replace(/\r/g, "");

          const [, _index, _name] = notnull(/^(\d+)_([^.]+)/.exec(entry));
          const index = parseInt(_index);
          const name = _name.replace(/_/g, " ");

          const [, div, style] = notnull(
            /^\s*(<div.+<\/div>)?\s*(<style.+<\/style>)?\s*$/is.exec(source)
          );

          return { index, name, div, style, source };
        })
    )
  )
    .sort((a, b) => a.index - b.index)
    .map(({ name, div, style, source }) => ({ name, div, style, source }));

  return minify(template({ stylesheets, animations, injectedScript, github }), {
    collapseWhitespace: true,
    minifyCSS: true,
    removeComments: true,
  });
};

const main = async () => {
  const config = await getConfig();

  const outputDir = config.output ?? "dist";
  const indexPath = path.join(outputDir, "index.html");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(indexPath, await generateIndex());
};

if (require.main === module) {
  main();
}

module.exports = { generateIndex };
