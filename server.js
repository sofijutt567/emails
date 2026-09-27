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
            <body style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7fa; padding: 24px;">
                <div style="max-width: 480px; margin: auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                    <div style="padding: 24px 28px 8px; text-align: center; border-bottom: 1px dashed #e2e8f0; padding-bottom: 18px;">
                        <div style="color:${BRAND_COLOR}; font-size:1.15rem; font-weight:700; letter-spacing:0.3px;">PharmPro Cloud</div>
                    </div>
                    <div style="padding: 26px 28px;">
                        <h2 style="margin-top:0; font-size:1.05rem; color:#1e293b;">Hi ${userName || 'Pharmacist'},</h2>
                        <p style="font-size: 14px; color: #475569; line-height: 1.6;">Welcome back! Your pharmacy management dashboard is now fully synced. You will receive automated alerts for low stock and expired medicines.</p>
                        <p style="font-size: 12.5px; color: #94a3b8;">If you didn't login, please secure your account.</p>
                    </div>
                    <div style="padding: 16px; text-align: center; border-top: 1px dashed #e2e8f0;">${FOOTER_HTML}</div>
                </div>
            </body>
        </html>`;
    
    sendSmtpEmail.sender = { "name": "PharmPro Support", "email": "pharmpro@healthjobportal.com" };
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
    
    sendSmtpEmail.sender = { "name": "PharmPro Alerts", "email": "pharmpro@healthjobportal.com" };
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

    const itemsRowsPlain = items.map(i => `
        <tr>
            <td style="padding:6px 0; font-size:12.5px; color:#334155;">${i.name}</td>
            <td style="padding:6px 0; font-size:12.5px; color:#334155; text-align:center;">${i.qty}</td>
            <td style="padding:6px 0; font-size:12.5px; color:#334155; text-align:right;">${i.price}</td>
            <td style="padding:6px 0; font-size:12.5px; color:#1e293b; text-align:right; font-weight:600;">${i.total}</td>
        </tr>
    `).join('');

    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = `Invoice from ${shopName}${billId ? ' - #' + billId.toString().slice(-6) : ''}`;
    const ZIGZAG_TOP = `background-color:#f1f5f9; background-image: linear-gradient(-45deg, transparent 8px, #f3f2ef 8px), linear-gradient(45deg, transparent 8px, #f3f2ef 8px); background-size: 16px 16px; background-position: 0 0; background-repeat: repeat-x; height: 12px;`;
    const ZIGZAG_BOTTOM = `background-color:#f1f5f9; background-image: linear-gradient(135deg, transparent 8px, #f3f2ef 8px), linear-gradient(-135deg, transparent 8px, #f3f2ef 8px); background-size: 16px 16px; background-position: 0 100%; background-repeat: repeat-x; height: 12px;`;
    sendSmtpEmail.htmlContent = `
        <html>
            <body style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; padding: 24px;">
                <div style="max-width: 380px; margin: auto;">

                    <!-- Torn/zigzag receipt top edge -->
                    <div style="${ZIGZAG_TOP}"></div>

                    <div style="background: #f3f2ef; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; padding: 22px 24px;">

                    <!-- Shop Header (centered, logo auto-scaled to fit) -->
                    <div style="text-align:center; padding-bottom:16px; border-bottom: 1px dashed #cbd5e1;">
                        ${shopLogo ? `
                        <table style="margin:0 auto 8px;">
                            <tr>
                                <td style="width:76px; height:66px; text-align:center; vertical-align:middle;">
                                    <img src="${shopLogo}" style="max-width:72px; max-height:62px; width:auto; height:auto; object-fit:contain; display:block; margin:0 auto;">
                                </td>
                            </tr>
                        </table>` : ''}
                        <div style="font-size:1.05rem; font-weight:700; color:#1e293b;">${shopName}</div>
                        ${shopAddress ? `<div style="font-size:11.5px; color:#94a3b8; margin-top:2px;">${shopAddress}</div>` : ''}
                        ${shopPhone ? `<div style="font-size:11.5px; color:#94a3b8;">Ph: ${shopPhone}</div>` : ''}
                    </div>

                    <!-- Invoice label -->
                    <div style="text-align:center; margin:14px 0 12px; font-size:11px; letter-spacing:1.5px; color:#94a3b8; text-transform:uppercase;">Invoice ${billId ? '#' + billId.toString().slice(-6) : ''}</div>

                    <!-- Patient Info -->
                    <div style="font-size:12.5px; color:#475569; padding:10px 0; border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1;">
                        <div><strong>Patient:</strong> ${patientLine}</div>
                        ${patient.phone ? `<div><strong>Mobile:</strong> ${patient.phone}</div>` : ''}
                        ${patient.district ? `<div><strong>District:</strong> ${patient.district}</div>` : ''}
                        <div><strong>Date:</strong> ${patient.date || ''}</div>
                    </div>

                    <!-- Items -->
                    <table style="width:100%; border-collapse:collapse; margin-top:14px;">
                        <thead>
                            <tr>
                                <th style="padding-bottom:6px; text-align:left; color:#94a3b8; font-size:10.5px; text-transform:uppercase; border-bottom:1px solid #e2e8f0;">Medicine</th>
                                <th style="padding-bottom:6px; text-align:center; color:#94a3b8; font-size:10.5px; text-transform:uppercase; border-bottom:1px solid #e2e8f0;">Qty</th>
                                <th style="padding-bottom:6px; text-align:right; color:#94a3b8; font-size:10.5px; text-transform:uppercase; border-bottom:1px solid #e2e8f0;">Price</th>
                                <th style="padding-bottom:6px; text-align:right; color:#94a3b8; font-size:10.5px; text-transform:uppercase; border-bottom:1px solid #e2e8f0;">Total</th>
                            </tr>
                        </thead>
                        <tbody>${itemsRowsPlain}</tbody>
                    </table>

                    <!-- Totals -->
                    <table style="width:100%; margin-top:14px; padding-top:12px; border-top: 1px dashed #cbd5e1; font-size:12.5px; color:#475569; border-collapse:collapse;">
                        <tr>
                            <td style="padding:3px 0;">Subtotal</td>
                            <td style="padding:3px 0; text-align:right;">Rs ${subtotal}</td>
                        </tr>
                        <tr>
                            <td style="padding:3px 0;">Discount</td>
                            <td style="padding:3px 0; text-align:right;">${discount || 0}%</td>
                        </tr>
                        <tr>
                            <td style="padding-top:10px; border-top: 1px dashed #cbd5e1; font-size:1.05rem; font-weight:800; color:#1e293b;">Total</td>
                            <td style="padding-top:10px; border-top: 1px dashed #cbd5e1; text-align:right; font-size:1.05rem; font-weight:800; color:#1e293b;">Rs ${bill}</td>
                        </tr>
                    </table>

                    <p style="margin-top:20px; font-size:12px; color:#64748b; text-align:center; font-style:italic;">${shopFooter}</p>

                    <div style="margin-top:16px; padding-top:14px; border-top: 1px dashed #cbd5e1; text-align:center;">${FOOTER_HTML}</div>

                    </div>

                    <!-- Torn/zigzag receipt bottom edge -->
                    <div style="${ZIGZAG_BOTTOM}"></div>

                </div>
            </body>
        </html>`;

    sendSmtpEmail.sender = { "name": shopName, "email": "pharmpro@healthjobportal.com" };
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
