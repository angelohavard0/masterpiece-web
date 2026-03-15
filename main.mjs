import express from "express";
import path from "path";
import { readFile } from "fs/promises";
import pkg from "pg";
const { Pool } = pkg;

const settings = JSON.parse(await readFile("./settings.json", "utf8"));

const db = {
    pool: new Pool({
        user: settings.database.user,
        host: settings.database.ip,
        database: settings.database.database,
        password: settings.database.password,
        port: settings.database.port,
    }),
};

db.run = async function (sql, args) {
    let client;
    try {
        client = await this.pool.connect();
        const res = await client.query(sql, args);
        return { res };
    } catch (err) {
        console.log(err);
        return { err };
    } finally {
        if (client) client.release();
    }
};

(async () => {
    try {
        const { res, err } = await db.run("SELECT NOW()");
        if (res.rows[0] !== undefined) {
            console.log("PostgreSQL connecté :", res.rows[0]);
        } else {
            console.error("Erreur PostgreSQL :", err);
        }
    } catch (err) {
        console.log(err);
    }
})();

db.get = function (route, sql, required = []) {
    app.get(route, async (req, res) => {
        try {
            if (!isConnected) return res.sendStatus(401);

            if (req.query.data === undefined)
                return res.status(400).json({ error: "data manquante" });

            let args;
            try {
                args = JSON.parse(decodeURIComponent(req.query.data));
            } catch {
                return res.status(400).json({ error: "json invalide" });
            }

            // Vérification des champs requis
            for (const field of required) {
                if (args[field] === undefined) {
                    return res.status(400).json({
                        error: `${field} manquante`,
                    });
                }
            }
            const values = required.map((k) => args[k]);
            const result = await db.run(sql, values);

            if (result.err) {
                return res.status(500).json(result.err);
            }

            res.json(result.res.rows);
        } catch {
            res.sendStatus(500);
        }
    });
};

db.post = function (route, sql, required = []) {
    app.post(route, async (req, res) => {
        try {
            if (!isConnected) return res.sendStatus(401);

            if (!req.body || Object.keys(req.body).length === 0)
                return res.status(400).json({ error: "body manquant" });

            const args = req.body;

            // Vérification des champs requis
            for (const field of required) {
                if (args[field] === undefined) {
                    return res.status(400).json({
                        error: `${field} manquante`,
                    });
                }
            }
            const values = required.map((k) => args[k]);
            const result = await db.run(sql, values);

            if (result.err) {
                return res.status(500).json(result.err);
            }

            res.json(result.res.rows ?? result.res);
        } catch {
            res.sendStatus(500);
        }
    });
};

db.delete = function (route, sql, required = []) {
    app.delete(route, async (req, res) => {
        try {
            if (!isConnected) return res.sendStatus(401);

            if (req.query.data === undefined)
                return res.status(400).json({ error: "data manquante" });

            let args;
            try {
                args = JSON.parse(decodeURIComponent(req.query.data));
            } catch {
                return res.status(400).json({ error: "json invalide" });
            }

            // Vérification des champs requis
            for (const field of required) {
                if (args[field] === undefined) {
                    return res.status(400).json({
                        error: `${field} manquante`,
                    });
                }
            }
            const values = required.map((k) => args[k]);
            const result = await db.run(sql, values);

            if (result.err) {
                return res.status(500).json(result.err);
            }

            res.json(result.res.rows ?? result.res);
        } catch {
            res.sendStatus(500);
        }
    });
};

const app = express();

app.use(express.json());

const publicPath = path.join(process.cwd(), "publicV2");
app.use(express.static(publicPath));

// variable
const isConnected = {
    value: false,
};

app.get("/isConnected", (req, res) => {
    res.json({ value: isConnected.value });
});

isConnected.notifyConnected = () => {
    isConnected.value = true;
};

// route pour obtenir le dernier badge scanné
const getScannerRfid = {
    clients: [],
};

app.get("/getScannerRfid", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    getScannerRfid.clients.push(res);

    req.on("close", () => {
        getScannerRfid.clients = getScannerRfid.clients.filter(
            (r) => r !== res,
        );
    });
});

getScannerRfid.notifyConnected = (rfid) => {
    getScannerRfid.clients.forEach((res) => {
        res.write(`data: ${JSON.stringify(rfid)}\n\n`);
        res.end();
    });

    getScannerRfid.clients = [];
};

// route pour être prévenu des accès badge
const notifAccesLog = {
    clients: [],
};

app.get("/notifAccesLog", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    notifAccesLog.clients.push(res);

    req.on("close", () => {
        notifAccesLog.clients = notifAccesLog.clients.filter((r) => r !== res);
    });
});

notifAccesLog.notifyConnected = () => {
    notifAccesLog.clients.forEach((res) => {
        res.write(`data: ${JSON.stringify("AccesLog")}\n\n`);
    });
};

// route pour activer l'interface et logger les accès
app.post("/access", async (req, res) => {
    try {
        const arduino = settings.arduino.login.find(
            (el) => `Bearer ${el.token}` === req.headers.authorization,
        );
        if (!arduino) return res.sendStatus(401);

        getScannerRfid.notifyConnected(req.body.UID);

        // Vérifier si le badge existe
        const checkResult = await db.run(
            `SELECT badge.id as badge_id, users.isadmin
             FROM badge
             JOIN users ON badge.user_id = users.id
             WHERE badge.rfid = $1
             AND badge.isdeleted = 0
             AND users.isdeleted = 0`,
            [req.body.UID],
        );

        const row = checkResult.res?.rows[0];

        if (!row) {
            // Badge inconnu ou supprimé → logger dans failedaccesslogs
            await db.run(
                "INSERT INTO failedaccesslogs (rfid) VALUES ($1)",
                [req.body.UID],
            );
            
            notifAccesLog.notifyConnected();
            return res.sendStatus(401);
        }

        // Badge connu → logger dans accesslogs
        const result = await db.run(
            `INSERT INTO accesslogs (log, badge_id)
             VALUES ('badge scanné', $1)
             RETURNING badge_id`,
            [row.badge_id],
        );

        if (result.err) return res.sendStatus(500);

        console.log("donné reçu:", req.body);

        const login = {
            login: true,
            adminLogin: row.isadmin === 1 && arduino.isAdmin,
        };

        notifAccesLog.notifyConnected();

        if (login.adminLogin) {
            isConnected.notifyConnected();
            console.log("interface administrateur déverrouillée");
        }

        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

// Route pour les logs réussis (avec db.get)
db.get(
    "/getAccesslogs",
    `
    SELECT 
        u.firstname,
        u.lastname,
        b.rfid,
        a.log,
        a.date
    FROM accesslogs a
    JOIN badge b ON a.badge_id = b.id
    JOIN users u ON b.user_id = u.id
    WHERE a.date >= NOW() - ($1 || ' days')::interval
    ORDER BY a.date DESC
    `,
    ["days"],
);

// Route pour les logs échoués (avec db.get)
db.get(
    "/getFailedAccesslogs",
    `
    SELECT 
        rfid,
        date
    FROM failedaccesslogs
    WHERE date >= NOW() - ($1 || ' days')::interval
    ORDER BY date DESC
    `,
    ["days"],
);

// routes d'accès à la db existantes
db.get(
    "/getBadgesByUser_id",
    "SELECT * FROM badge WHERE isdeleted = 0 AND user_id = $1",
    ["user_id"],
);

db.get("/getUserById", "SELECT * FROM users WHERE isdeleted = 0 AND id = $1", [
    "id",
]);

db.get(
    "/getAccesslogsByUser_id",
    `
    SELECT 
        b.rfid,
        a.date,
        a.log,
        a.id
    FROM accesslogs a
    JOIN badge b ON a.badge_id = b.id
    WHERE b.user_id = $1
    AND a.date >= NOW() - ($2 || ' days')::interval
    ORDER BY a.date DESC
    `,
    ["id", "days"],
);

db.get(
    "/searchUsersByQuery",
    `
    SELECT *
    FROM users
    WHERE (firstname ILIKE '%' || $1 || '%' OR lastname ILIKE '%' || $1 || '%')
    AND isdeleted = 0
    ORDER BY date DESC
    LIMIT $2
    `,
    ["query", "number"],
);

db.post(
    "/addBadgesByUser_idAndRfid",
    "INSERT INTO badge (rfid, user_id) VALUES ($1, $2)",
    ["rfid", "user_id"],
);

db.post(
    "/addUser",
    "INSERT INTO users (firstname, lastname, isadmin) VALUES ($1, $2, $3)",
    ["firstname", "lastname", "isadmin"],
);

db.delete("/deleteBadgesById", "UPDATE badge SET isdeleted = 1 WHERE id = $1", [
    "id",
]);

db.delete("/deleteUsersById", "UPDATE users SET isdeleted = 1 WHERE id = $1", [
    "id",
]);

db.get(
    "/getUserStats",
    `
    SELECT 
        COUNT(*) FILTER (WHERE isdeleted = 0) as total_users,
        COUNT(*) FILTER (WHERE isdeleted = 0 AND isadmin = 1) as total_admins
    FROM users
    `,
    [] // Pas de paramètres requis
);

db.get(
    "/getBadgeStats",
    `
    SELECT COUNT(*) as total_badges
    FROM badge
    WHERE isdeleted = 0
    `,
    [] // Pas de paramètres requis
);

app.listen(settings.server.port, () => {
    console.log(`Serveur lancé sur http://localhost:${settings.server.port}`);
});