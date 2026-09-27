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

// Footer bilkul waisa hi jaisa baaqi pages (receipt/customer.js) mein hai
const FOOTER_HTML = `
    <div style="font-size:12px; color:#94a3b8;">Powered by SufianX &amp; PharmPro Limited</div>
    <div style="font-size:11px; color:#cbd5e1; margin-top:2px;">&copy; 2026 PharmPro Management System. All rights reserved.</div>
`;

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
 * 1. WELCOME EMAIL (Professional — same header/footer style as Invoice)
 */
app.post('/api/welcome-email', async (req, res) => {
    const { email, userName } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email is required" });

    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "🚀 Welcome to PharmPro - Account Active!";
    sendSmtpEmail.htmlContent = `
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f4f7fa; padding: 24px;">
                <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <div style="background: ${BRAND_COLOR}; padding: 24px; text-align: center;">
                        <div style="color:#fff; font-size:1.3rem; font-weight:700;">PharmPro Cloud</div>
                    </div>
                    <div style="padding: 30px;">
                        <h2 style="margin-top:0; color:#1e293b;">Hi ${userName || 'Pharmacist'},</h2>
                        <p style="font-size: 15px; color: #475569; line-height: 1.6;">Welcome back! Your pharmacy management dashboard is now fully synced. You will receive automated alerts for low stock and expired medicines.</p>
                        <p style="font-size: 13px; color: #94a3b8;">If you didn't login, please secure your account.</p>
                    </div>
                    <div style="background: #f8fafc; padding: 18px; text-align: center;">${FOOTER_HTML}</div>
                </div>
            </body>
        </html>`;
    
    sendSmtpEmail.sender = { "name": "PharmPro Support", "email": "info@pharmprolimtedhealthjobportal.com" };
    sendSmtpEmail.to = [{ "email": email }];

    try {
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 2. SMART STOCK ALERTS (Low Stock / Out of Stock only — Expiry alert removed)
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

    if (type === 'OUT_OF_STOCK' || currentQty <= 0) {
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
                    <div style="text-align: center; margin-top: 10px;">${FOOTER_HTML}</div>
                </div>
            </body>
        </html>`;
    
    sendSmtpEmail.sender = { "name": "PharmPro Alerts", "email": "info@pharmprolimtedhealthjobportal.com" };
    sendSmtpEmail.to = [{ "email": email }];

    try {
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 3. PROFESSIONAL INVOICE EMAIL (Billing System se customer ko — logo + shop branding ke saath)
 */
app.post('/api/invoice-email', async (req, res) => {
    const { customerEmail, replyToEmail, pharmacy = {}, patient = {}, items = [], subtotal, discount, bill, billId } = req.body;
    if (!customerEmail) return res.status(400).json({ success: false, error: "Customer email is required" });

    const shopName = pharmacy.name || "PharmPro";
    const shopLogo = pharmacy.logo || "";
    const shopAddress = pharmacy.address || "";
    const shopPhone = pharmacy.phone || "";
    const shopFooter = pharmacy.footer || "Get Well Soon!";

    const patientLine = `${patient.name || 'Walk-in'}${patient.age ? ' (' + patient.age + (patient.gender ? ', ' + patient.gender : '') + ')' : (patient.gender ? ' (' + patient.gender + ')' : '')}`;

    const itemsRows = items.map(i => `
        <tr>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">${i.name}</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">${i.qty}</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:right;">Rs ${i.price}</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:right;">Rs ${i.total}</td>
        </tr>
    `).join('');

    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = `Invoice from ${shopName}${billId ? ' - #' + billId.toString().slice(-6) : ''}`;
    sendSmtpEmail.htmlContent = `
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f4f7fa; padding: 24px;">
                <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">

                    <table style="width:100%; background:${BRAND_COLOR};">
                        <tr>
                            <td style="padding:24px; width:60px;">
                                ${shopLogo ? `<img src="${shopLogo}" style="width:48px; height:48px; object-fit:contain; border-radius:8px; background:#fff; padding:4px; display:block;">` : ''}
                            </td>
                            <td style="padding:24px 24px 24px 0; color:#fff;">
                                <div style="font-size:1.2rem; font-weight:700;">${shopName}</div>
                                ${shopAddress ? `<div style="font-size:0.8rem; opacity:0.9;">${shopAddress}</div>` : ''}
                                ${shopPhone ? `<div style="font-size:0.8rem; opacity:0.9;">Ph: ${shopPhone}</div>` : ''}
                            </td>
                        </tr>
                    </table>

                    <div style="padding: 28px;">
                        <h2 style="margin:0 0 16px; color:#1e293b;">Invoice</h2>

                        <div style="background:#f8fafc; border-radius:8px; padding:14px 16px; margin-bottom:20px; font-size:0.9rem; color:#475569;">
                            <div><strong>Patient:</strong> ${patientLine}</div>
                            ${patient.phone ? `<div><strong>Mobile:</strong> ${patient.phone}</div>` : ''}
                            ${patient.district ? `<div><strong>District:</strong> ${patient.district}</div>` : ''}
                            <div><strong>Date:</strong> ${patient.date || ''}</div>
                        </div>

                        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                            <thead>
                                <tr style="background:#f1f5f9;">
                                    <th style="padding:8px 10px; text-align:left; color:#64748b; font-size:0.75rem; text-transform:uppercase;">Medicine</th>
                                    <th style="padding:8px 10px; text-align:center; color:#64748b; font-size:0.75rem; text-transform:uppercase;">Qty</th>
                                    <th style="padding:8px 10px; text-align:right; color:#64748b; font-size:0.75rem; text-transform:uppercase;">Price</th>
                                    <th style="padding:8px 10px; text-align:right; color:#64748b; font-size:0.75rem; text-transform:uppercase;">Total</th>
                                </tr>
                            </thead>
                            <tbody>${itemsRows}</tbody>
                        </table>

                        <div style="margin-top:16px; text-align:right; font-size:0.9rem; color:#475569;">
                            <div>Subtotal: Rs ${subtotal}</div>
                            <div>Discount: ${discount || 0}%</div>
                            <div style="font-size:1.2rem; font-weight:800; color:${BRAND_COLOR}; margin-top:6px;">Total: Rs ${bill}</div>
                        </div>

                        <p style="margin-top:24px; font-size:0.85rem; color:#475569; text-align:center;">${shopFooter}</p>
                    </div>

                    <div style="background: #f8fafc; padding: 18px; text-align: center;">${FOOTER_HTML}</div>
                </div>
            </body>
        </html>`;

    sendSmtpEmail.sender = { "name": shopName, "email": "info@pharmprolimtedhealthjobportal.com" };
    sendSmtpEmail.to = [{ "email": customerEmail }];
    if (replyToEmail) sendSmtpEmail.replyTo = { "email": replyToEmail, "name": shopName };

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
