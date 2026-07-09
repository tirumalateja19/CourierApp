import fs from "fs";

const renderTemplate = (templatePath, data) => {
  let html = fs.readFileSync(templatePath, "utf-8");
  for (const key in data) {
    const regex = new RegExp(`{{${key}}}`, "g");
    html = html.replace(regex, data[key] ?? "");
  }
  return html;
};

export default renderTemplate;
