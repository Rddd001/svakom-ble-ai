/**
 * SVAKOM SL278H BLE 中继服务器
 * 部署在 Railway 上，作为 AI ↔ 手机 BLE 中继的桥梁
 *
 * 接口：
 *   POST /toy-cmd     AI 发送控制指令（需要 x-bridge-secret）
 *   GET  /toy-next    手机中继轮询取指令
 *   GET  /toy-status  查看当前状态
 *   GET  /health      健康检查
 *   GET  /            前端页面（index.html）
 */

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SECRET = process.env.BRIDGE_SECRET || "";

// ---------- 状态 ----------
let cmdQueue = [];
let lastCmd = null;
let lastCmdTime = 0;
let bridgeOnline = false;
let bridgeLastSeen = 0;

// ---------- 鉴权中间件 ----------
function auth(req, res, next) {
  if (!SECRET) return next();
  const s = req.headers["x-bridge-secret"] || req.query.secret || "";
  if (s !== SECRET) return res.status(403).json({ error: "forbidden" });
  next();
}

// ---------- 根路由：返回前端页面 ----------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ---------- AI → 服务器：发指令 ----------
app.post("/toy-cmd", auth, (req, res) => {
  const cmd = req.body;
  if (!cmd || typeof cmd !== "object") {
    return res.status(400).json({ error: "invalid command" });
  }
  cmdQueue.push(cmd);
  lastCmd = cmd;
  lastCmdTime = Date.now();
  console.log(`收到指令: ${JSON.stringify(cmd)}`);
  res.json({ ok: true, queued: cmdQueue.length });
});

// ---------- 手机中继 → 服务器：轮询取指令 ----------
app.get("/toy-next", auth, (req, res) => {
  bridgeOnline = true;
  bridgeLastSeen = Date.now();
  if (cmdQueue.length > 0) {
    const cmd = cmdQueue.shift();
    return res.json(cmd);
  }
  res.json({});
});

// ---------- 状态查询 ----------
app.get("/toy-status", auth, (req, res) => {
  const now = Date.now();
  res.json({
    bridge_online: bridgeOnline && (now - bridgeLastSeen < 10000),
    bridge_last_seen: bridgeLastSeen ? new Date(bridgeLastSeen).toISOString() : null,
    queue_length: cmdQueue.length,
    last_cmd: lastCmd,
    last_cmd_time: lastCmdTime ? new Date(lastCmdTime).toISOString() : null,
  });
});

// ---------- 健康检查 ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ---------- 启动 ----------
app.listen(PORT, () => {
  console.log(`SVAKOM Bridge Server running on port ${PORT}`);
  console.log(`   SECRET: ${SECRET ? "已设置" : "未设置（不安全）"}`);
});
