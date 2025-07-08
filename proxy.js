// proxy.js
const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Para hacer las solicitudes HTTP/HTTPS

const app = express();
const PORT = process.env.PORT || 3001; // Puedes cambiar el puerto si es necesario

// Habilitar CORS para todas las solicitudes.
// En un entorno de producción, es recomendable restringir el origin a tu dominio.
app.use(cors());

// Middleware para parsear JSON si lo necesitas (no estrictamente necesario para este caso)
app.use(express.json());

// Ruta para manejar las solicitudes proxy
app.all('/proxy', async (req, res) => {
    const targetUrl = req.query.url; // La URL de destino se pasa como un parámetro 'url' en la query string

    if (!targetUrl) {
        return res.status(400).json({ error: 'Falta el parámetro "url" en la solicitud.' });
    }

    try {
        // Construye la URL de destino completa, incluyendo los parámetros originales
        const originalUrl = new URL(targetUrl);
        for (const key in req.query) {
            if (key !== 'url') { // No incluyas el parámetro 'url' del proxy en la URL de destino
                originalUrl.searchParams.append(key, req.query[key]);
            }
        }

        // Configura la solicitud a la URL de destino
        const config = {
            method: req.method, // Usa el mismo método HTTP de la solicitud original (GET, POST, etc.)
            url: originalUrl.toString(),
            headers: {
                // Opcional: Reenviar algunos encabezados de la solicitud original
                // Ten cuidado con qué encabezados reenvías, algunos pueden causar problemas
                'User-Agent': req.headers['user-agent'] || 'Node.js Proxy',
                // 'Authorization': req.headers['authorization'], // Si necesitas reenviar tokens
                // Elimina el encabezado Host para evitar problemas con algunos servidores
                'Host': undefined
            },
            // Si la solicitud original tenía un cuerpo (ej. POST), reenvíalo
            data: req.body,
            responseType: 'arraybuffer' // Importante para manejar binarios (como streams M3U)
        };

        console.log(`Proxying request to: ${config.url}`);

        const response = await axios(config);

        // Reenvía los encabezados de la respuesta del servidor de destino
        for (const key in response.headers) {
            if (response.headers.hasOwnProperty(key)) {
                res.setHeader(key, response.headers[key]);
            }
        }

        // Envía el código de estado y los datos de la respuesta
        res.status(response.status).send(response.data);

    } catch (error) {
        console.error('Error en el proxy:', error.message);
        if (error.response) {
            // El servidor de destino respondió con un error (ej. 403, 404)
            console.error('Respuesta de error del destino:', error.response.status, error.response.data.toString());
            res.status(error.response.status).send(error.response.data);
        } else {
            // Error de red o configuración del proxy
            res.status(500).json({ error: 'Error interno del proxy', details: error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
    console.log(`Access it at http://localhost:${PORT}/proxy?url=YOUR_IPTV_URL`);
});
