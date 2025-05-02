const fs = require("node:fs/promises");
const path = require("node:path");
const ejs = require("ejs");
const Prism = require("prismjs");
const { parse, HTMLElement } = require("node-html-parser");
const postcss = require("postcss");
const postcssPrefixSelector = require("postcss-prefix-selector");

const prismCssPath = require.resolve("prismjs/themes/prism.css");

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
 * @param {string} source
 * @param {string} parentClass
 * @returns {{div: string; stylesheet: string}|null>}
 */
const parseHtml = (source, parentClass) => {
  const elem = parse(source);
  let templateElem = null;
  let styleElem = null;
  for (const child of elem.children) {
    if (child.rawTagName === "template") {
      templateElem = child;
    } else if (child.rawTagName === "style") {
      styleElem = child;
    }
  }
  if (!templateElem) {
    return null;
  }

  let stylesheet = "";
  if (styleElem) {
    const originalStylesheet = styleElem.innerHTML;
    stylesheet = postcss([postcssPrefixSelector({ prefix: `.${parentClass}` })]).process(originalStylesheet, {
      from: undefined,
    }).css;
  }

  const div = new HTMLElement("div", { class: parentClass });
  div.append(...templateElem.childNodes);

  return { div: div.outerHTML, stylesheet };
};

/**
 * @param {string | undefined} injectedScript
 * @returns {Promise<string>}
 */
const generateIndex = async (injectedScript = "") => {
  const config = await getConfig();

  const templatePath = path.join(__dirname, config.template ?? "template.ejs");
  const stylesheetDir = path.join(__dirname, config.stylesheets ?? "stylesheets");
  const animationDir = path.join(__dirname, config.animations ?? "animations");
  const github = config.github ?? "";

  const templateContent = (await fs.readFile(templatePath)).toString();
  const template = ejs.compile(templateContent);

  /** @type {{index: number; source: string}[]} */
  const styles = [];

  for (const entry of await fs.readdir(stylesheetDir)) {
    if (!entry.match(/\.css$/)) {
      continue;
    }
    const filename = path.join(stylesheetDir, entry);
    const [, _index, _name] = notnull(/^(\d+)_/.exec(entry));
    const index = parseInt(_index);
    const source = (await fs.readFile(filename)).toString().replace(/\r\n|\r/g, "\n");
    styles.push({ index, source });
  }

  const prismCss = (await fs.readFile(prismCssPath)).toString().replace(/\r\n|\r/g, "\n");
  styles.push({ index: -1, source: prismCss });

  /** @type {{index: number; name: string; source: string, highlight: string}[]} */
  const anims = [];

  for (const entry of await fs.readdir(animationDir)) {
    if (!entry.match(/\.html$/)) {
      continue;
    }
    const filename = path.join(animationDir, entry);
    const [, _index, _name] = notnull(/^(\d+)_([^.]+)/.exec(entry));
    const index = parseInt(_index);
    const name = _name.replace(/_/g, " ");
    const source = (await fs.readFile(filename)).toString().replace(/\r\n|\r/g, "\n");

    const parentClass = name.replace(/ /g, "-").toLowerCase();
    const parseResult = parseHtml(source, parentClass);

    if (parseResult) {
      const { div, stylesheet } = parseResult;
      const highlight = Prism.highlight(source, Prism.languages.html);
      styles.push({ index: Infinity, source: stylesheet });
      anims.push({ index, name, source: div, highlight });
    }
  }

  const stylesheets = styles.sort((a, b) => a.index - b.index || 0).map(({source}) => `<style>${source}</style>`);
  const animations = anims
    .sort((a, b) => a.index - b.index)
    .map(({ name, source, highlight }) => ({ name, source, highlight }));

  // const animationEntries = await fs.readdir(animationDir);
  // const animations = (
  //   await Promise.all(
  //     animationEntries
  //       .filter((entry) => /\.html$/.test(entry))
  //       .map(async (entry) => {
  //         const filename = path.join(animationDir, entry);
  //         const [, _index, _name] = notnull(/^(\d+)_([^.]+)/.exec(entry));
  //         const index = parseInt(_index);
  //         const name = _name.replace(/_/g, " ");
  //         const source = (await fs.readFile(filename)).toString().replace(/\r\n|\r/g, "\n");

  //         const parentClass = name.replace(/ /g, "-").toLowerCase();
  //         const parseResult = parseHtml(source, parentClass);

  //         if (!parseResult) {
  //           return [];
  //         }

  //         const { div, stylesheet } = parseResult;
  //         return [{ index, name, div, stylesheet, source: Prism.highlight(source, Prism.languages.html) }];
  //       })
  //   )
  // )
  //   .flat(1)
  //   .sort((a, b) => a.index - b.index);

  return template(
    { stylesheets, animations, injectedScript, github },
    {
      collapseWhitespace: true,
      minifyCSS: true,
      removeComments: true,
    }
  );
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
