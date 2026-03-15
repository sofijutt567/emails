const express = require('express');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const cors = require('cors');
// Axios ki zaroorat Vercel pe nahi hogi kyunki setInterval wahan suspend ho jata hai

const app = express();

// --- Middlewares ---
app.use(cors({ 
    origin: '*', 
    methods: ['GET', 'POST'], 
    allowedHeaders: ['Content-Type'] 
}));
app.use(express.json());

// --- BREVO CONFIG ---
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY; 
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const BRAND_COLOR = "#2563eb";
const FOOTER_TEXT = "© 2026 Tech SufianX/ PharmPro Cloud Solutions. All rights reserved.";

// --- Endpoints ---
app.get('/ping', (req, res) => res.status(200).send("PONG! 🏓"));

app.get('/', (req, res) => {
    res.send(`
        <div style="text-align:center; padding:50px; font-family:sans-serif;">
            <h1 style="color:#2563eb;">PharmPro API is Live on Vercel! ✅</h1>
            <p>Email Services are active and ready to process requests.</p>
        </div>
    `);
});

/**
 * 1. WELCOME EMAIL
 */
app.post('/api/welcome-email', async (req, res) => {
    const { email, userName } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email is required" });

    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "🚀 Welcome to PharmPro - Account Active!";
    sendSmtpEmail.htmlContent = `
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f4f7fa; padding: 30px;">
                <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <div style="background: ${BRAND_COLOR}; padding: 25px; text-align: center; color: white;">
                        <h1 style="margin:0;">PharmPro Cloud</h1>
                    </div>
                    <div style="padding: 30px;">
                        <h2>Hi ${userName || 'Pharmacist'},</h2>
                        <p style="font-size: 16px; color: #475569; line-height: 1.6;">Welcome back! Your pharmacy management dashboard is now fully synced. You will receive automated alerts for low stock and expired medicines.</p>
                        <p style="font-size: 14px; color: #64748b;">If you didn't login, please secure your account.</p>
                    </div>
                    <div style="background: #f8fafc; padding: 15px; text-align: center; color: #94a3b8; font-size: 12px;">${FOOTER_TEXT}</div>
                </div>
            </body>
        </html>`;
    
    sendSmtpEmail.sender = { "name": "PharmPro Support", "email": "sufiangsufiang15@gmail.com" };
    sendSmtpEmail.to = [{ "email": email }];

    try {
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 2. SMART STOCK & EXPIRY ALERTS
 */
app.post('/api/stock-alert', async (req, res) => {
    const { email, itemName, currentQty, type } = req.body;
    if (!email || !itemName) return res.status(400).json({ success: false, error: "Data missing" });

    let config = { 
        subject: `⚠️ Alert: ${itemName}`, 
        title: "Inventory Update", 
        color: BRAND_COLOR, 
        msg: "An update is available for your stock." 
    };

    if (type === 'AUTO_REMOVED_EXPIRED') {
        config = { subject: `🚫 Expiry Alert: ${itemName}`, title: "Medicine Expired", color: "#ef4444", msg: "This medicine has expired and has been flagged for removal." };
    } else if (type === 'OUT_OF_STOCK' || currentQty <= 0) {
        config = { subject: `❌ Out of Stock: ${itemName}`, title: "Stock Finished", color: "#000000", msg: "Zero quantity remaining. Please restock this item immediately." };
    } else if (type === 'LOW_STOCK') {
        config = { subject: `⚠️ Low Stock Warning: ${itemName}`, title: "Running Low", color: "#f59e0b", msg: "This item is below the safety threshold (5 units)." };
    }

    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = config.subject;
    sendSmtpEmail.htmlContent = `
        <html>
            <body style="font-family: sans-serif; background-color: #f8fafc; padding: 20px;">
                <div style="max-width: 500px; margin: auto; background: white; border-radius: 10px; border-top: 8px solid ${config.color}; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h2 style="color: #1e293b; margin-top: 0;">${config.title}</h2>
                    <p style="color: #475569;">${config.msg}</p>
                    <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Medicine:</strong> ${itemName}</p>
                        <p style="margin: 5px 0;"><strong>Current Quantity:</strong> <span style="color:${config.color}; font-weight:bold;">${currentQty}</span></p>
                    </div>
                    <p style="font-size: 11px; color: #94a3b8; text-align: center;">${FOOTER_TEXT}</p>
                </div>
            </body>
        </html>`;
    
    sendSmtpEmail.sender = { "name": "PharmPro Alerts", "email": "sufiangsufiang15@gmail.com" };
    sendSmtpEmail.to = [{ "email": email }];

    try {
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// VERCEL EXPORT (Zaroori hai)
module.exports = app;

// Local development ke liye
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Local Server: http://localhost:${PORT}`));
}
