import { BrowserPod } from '@leaningtech/browserpod'
import { copyFile } from './utils'

// Initialize the Pod
const pod = await BrowserPod.boot({apiKey:import.meta.env.VITE_BP_APIKEY});

// Create a Terminal
const terminal = await pod.createDefaultTerminal(document.querySelector("#console"));

// Hook the portal to preview the web page in an iframe
const portalIframe = document.getElementById("portal");
const urlDiv = document.getElementById("url");
pod.onPortal(({ url, port }) => {
  urlDiv.innerHTML = `Portal available at <a href="${url}">${url}</a> for local server listening on port ${port}`;
  portalIframe.src = url;
});

// Copy our project files
const homePath = "/home/user";
const projectPath = `${homePath}/project`;
await pod.createDirectory(projectPath);
await copyFile(pod, "project/main.js", homePath);
await copyFile(pod, "project/package.json", homePath);
await pod.run("mkdir", ["-p", `${projectPath}/public`], {terminal});
await copyFile(pod, "project/public/index.html", homePath);

// Install dependencies
await pod.run("npm", ["install"], {echo:true, terminal:terminal, cwd: projectPath});

// Run the web server — bridge .env keys into the sandbox via env array
await pod.run("node", ["main.js"], {
  echo: true,
  terminal: terminal,
  cwd: projectPath,
  env: [
    `CALL_ALERT_MODE=twilio`,
    `ANTHROPIC_API_KEY=${import.meta.env.VITE_ANTHROPIC_API_KEY || ""}`,
    `TWILIO_ACCOUNT_SID=${import.meta.env.VITE_TWILIO_ACCOUNT_SID || ""}`,
    `TWILIO_AUTH_TOKEN=${import.meta.env.VITE_TWILIO_AUTH_TOKEN || ""}`,
    `TWILIO_PHONE_NUMBER=${import.meta.env.VITE_TWILIO_PHONE_NUMBER || ""}`,
    `ALERT_PHONE_NUMBER=${import.meta.env.VITE_ALERT_PHONE_NUMBER || ""}`,
  ],
});
