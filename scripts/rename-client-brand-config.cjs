const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "../client/src");
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
for (const file of walk(root)) {
  if (!/\.(ts|tsx|css)$/.test(file)) continue;
  let src = fs.readFileSync(file, "utf8");
  const before = src;
  src = src.replace(/tenantConfig/g, "bonattoConfig");
  src = src.replace(/TenantRuntimeConfig/g, "BonattoRuntimeConfig");
  src = src.replace(/useTenantConfig/g, "useBonattoConfig");
  src = src.replace(/@\/shared\/tenant\/use-tenant-config/g, "@/hooks/use-bonatto-config");
  src = src.replace(/@\/shared\/tenant\/tenant-config/g, "@/config/bonatto");
  src = src.replace(/DEFAULT_TENANT_CONFIG/g, "BONATTO_CONFIG");
  src = src.replace(/tenantAdminStyle/g, "bonattoAdminStyle");
  src = src.replace(/--tenant-/g, "--bonatto-");
  src = src.replace(/WhiteLabelPageKey/g, "BonattoPageKey");
  src = src.replace(/WhiteLabelAdminTab/g, "BonattoAdminTab");
  src = src.replace(/@shared\/whiteLabel/g, "@shared/bonattoConfig");
  if (src !== before) fs.writeFileSync(file, src);
}
console.log("Client brand config names updated");