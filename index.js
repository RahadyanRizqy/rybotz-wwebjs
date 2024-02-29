const { Client, LocalAuth, MessageMedia }= require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const os = require('os');
const { format } = require('date-fns');
const { zonedTimeToUtc } = require('date-fns-tz');
const { uploadBase64, deleteExistingData, db, admin } = require('./upload');
const fs = require('fs');
const path = require('path');

let client;
const clientId = 'id1-botpres';

if (os.platform() === 'linux') {
    client = new Client({
        puppeteer: {
            headless: true,
            executablePath: '/usr/bin/google-chrome-stable',
            args: [ '--no-sandbox', '--disable-setuid-sandbox' ]
        },
        ffmpeg: './ffmpeg.exe',
        authStrategy: new LocalAuth({ clientId: process.env.CLIENT_ID }),
    });
} else {
    client = new Client({
        puppeteer: {
            headless: true,
            args: [ '--no-sandbox', '--disable-setuid-sandbox' ]
        },
        ffmpeg: './ffmpeg.exe',
        authStrategy: new LocalAuth({ clientId: process.env.CLIENT_ID }),
    });
}

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Ready!');
});

// FUNCTIONS //
function formatDateTimeNow(timeZoneConfig, dateTimeFormat) {
    return format(zonedTimeToUtc(new Date(), timeZoneConfig), dateTimeFormat, { timeZone: timeZoneConfig });
}

function getKeyByValue(value, obj) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key].includes(value)) {
            return key;
        }
    }
    return null;
}
function extractNumericPart(str, pattern) {
    if (!str) {
        return null;
    }
    const match = str.match(pattern);
    if (match && match[1]) {
        return parseInt(match[1]);
    }
    return null;
}

function logErrorToFile(errorMsg) {
    const logDirectory = 'errorlog';
    const timestamp = formatDateTimeNow('Asia/Jakarta', 'dd-MM-yyyy-HH-mm-ss');
    const logFilePath = path.join(logDirectory, `${timestamp}.log`);
    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory);
    }
    fs.appendFile(logFilePath, errorMsg + '\n', (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
}
// END FUNCTIONS //

client.on('message', async (message) => {
    try {
        const date = formatDateTimeNow('Asia/Jakarta', 'dd-MM-yyyy');
        const datetime = formatDateTimeNow('Asia/Jakarta', 'dd-MM-yyyy HH.mm.ss');
        const chat = await message.getChat();
        const messageBody = message.body.split("#");

        console.log(message);
    
        if (messageBody[0] === 'help') {
            await chat.sendMessage('Contoh Pemakaian\n\n1. Mengisi Kehadiran\nhadir#NIM#pertemuan0\ncth: hadir#212410103087#pertemuan11\n\n2. Mengajukan Perizinan (Surat Berupa Softfile PDF/Gambar)\nizin#NIM#pertemuan0#pesanataualasan\ncth: izin#212410101059#pertemuan12#Assalamualaikum/Selamat siang permisi saya izin dikarenakan blablabla...\n\n3. Mengajukan Perizinan (Bila Masih Belum Ada Softfile)\nizin#NIM#pertemuan0#pesanataualasan#nyusul\ncth: izin#212410103073#pertemuan13#Assalamualaikum/Selamat siang permisi saya izin dikarenakan blablabla...#nyusul\n\n*NOTE:* Semua pesan dikirim dengan mencantumkan gambar saat sesi kelas atau surat saat perizinan (bila ada), tidak boleh dipisah - pisah nanti ngambek dan bingung soalnya emang awigwog...\n\nContoh pengiriman sebagai berikut');
            const exampleImage = MessageMedia.fromFilePath('contoh.jpeg');
            const examplePDF = MessageMedia.fromFilePath('contoh.pdf');
            await chat.sendMessage(exampleImage, {
                caption: 'hadir#212410103087#pertemuan0'
            });
            await chat.sendMessage(examplePDF, {
                caption: 'izin#212410103087#pertemuan0'
            });
            return
        }

        const nim = messageBody[1];
        const kelas = getKeyByValue(nim, require('./database.json'));
        const pertemuan = extractNumericPart(messageBody[2], /pertemuan(\d+)/) ?? null;
        const alasan = messageBody[3] ?? null;
        
        if (messageBody[0] === 'hadir') {
            if (!kelas || !pertemuan || messageBody.length <= 2) {
                await chat.sendMessage('Ada yang salah coba ketik *help*!');
                return
            }
            if (message.hasMedia) {
                const media = await message.downloadMedia();
                const formatFileName = `${nim}_${kelas}_hp${pertemuan}_${datetime}` + '.' + media.mimetype.split('/')[1];
                const dest = `kelas_${kelas}/dok_hadir`;
                const checkData = await db.ref(`${kelas}/${nim}/hadir/pertemuan${pertemuan}`).once('value');
                if (checkData.exists()) {
                    await deleteExistingData(checkData.val());
                    await db.ref(`${kelas}/${nim}/hadir/pertemuan${pertemuan}`).set(`${dest}/${formatFileName}`);
                }
                else {
                    await db.ref(`${kelas}/${nim}/hadir/pertemuan${pertemuan}`).set(`${dest}/${formatFileName}`);
                }
                uploadBase64(media.data, formatFileName, dest)
                    .then(async (res) => {
                        await chat.sendMessage(`*Kehadiran Praktikan PWEB Kelas ${kelas.toUpperCase()}*\n\nPertemuan Ke: ${pertemuan}\nTanggal: ${date}\nNIM: ${nim}\n\nSudah tersimpan, jangan lupa hadir di pertemuan berikutnya! 😇👍`);
                    })
                    .catch((err) => {
                        throw err;
                    });
            }
            else {
                await chat.sendMessage('Cantumkan media!');
            }

        }

        if (messageBody[0] === 'izin') {
            if (!kelas || !pertemuan || messageBody.length <= 3) {
                await chat.sendMessage('Ada yang salah coba ketik *help*!');
                return
            }

            if (message.hasMedia) {
                const media = await message.downloadMedia();
                const formatFileName = `${nim}_${kelas}_ip${pertemuan}_${datetime}` + '.' + media.mimetype.split('/')[1];
                const dest = `kelas_${kelas}/dok_izin`;
                const checkData = await db.ref(`${kelas}/${nim}/izin/pertemuan${pertemuan}`).once('value');
                if (checkData.exists()) {
                    await deleteExistingData(checkData.val());
                    await db.ref(`${kelas}/${nim}/izin/pertemuan${pertemuan}`).set({
                        'dok': `${dest}/${formatFileName}`,
                        'alasan': `${alasan}`
                    });
                }
                else {
                    await db.ref(`${kelas}/${nim}/izin/pertemuan${pertemuan}`).set({
                        'dok': `${dest}/${formatFileName}`,
                        'alasan': `${alasan}`
                    });
                }
                uploadBase64(media.data, formatFileName, dest)
                    .then(async (res) => {
                        await chat.sendMessage(`*Perizinan Praktikan PWEB Kelas ${kelas}*\n\nPertemuan Ke: ${pertemuan}\nTanggal: ${date}\nNIM: ${nim}\nAlasan: ${alasan}\n\nSudah tersimpan, jangan lupa untuk surat fisiknya ya! 😇👍`);
                    })
                    .catch((err) => {
                        throw err;
                    });
            }
            else {
                await chat.sendMessage(`*Perizinan Praktikan PWEB Kelas ${kelas}*\n\nPertemuan Ke: ${pertemuan}\nTanggal: ${date}\nNIM: ${nim}\nAlasan: ${alasan}\n\nSudah tersimpan, jangan lupa untuk konfirmasi suratnya ke asprak ya!\nKarena suratnya nyusul! 😇👍`);
            }
        }

        if (messageBody[0] === 'id') {
            if (!kelas) {
                await chat.sendMessage('NIM tidak terdaftar!');
                return
            }
            await chat.sendMessage(`Praktikan PWEB Kelas ${kelas.toUpperCase()}\nNIM: ${nim}\n\n*Terkonfirmasi!*`);
        }

        if (messageBody[0] === 'dok') {
            if (messageBody.length <= 2) {
                await chat.sendMessage('Ada yang salah!');
            }
            if (!message.hasMedia) {
                await chat.sendMessage('Cantumkan media!');
                return
            }
            const media = await message.downloadMedia();
            const formatFileName = `${nim}_dp${pertemuan}_${datetime}` + '.' + media.mimetype.split('/')[1];
            const dest = `kelas_${nim}/dok_kelas`;
            uploadBase64(media.data, formatFileName, dest)
                .then(async (res) => {
                    await chat.sendMessage(`*Dokumentasi PWEB Kelas ${nim.toUpperCase()} Pertemuan ${pertemuan}*\n\nSudah tersimpan, jangan lupa hadir di pertemuan berikutnya! 😇👍`);
                })
                .catch((err) => {
                    throw err;
                });
        }
    }
    catch (error) {
        await client.sendMessage(message.from, 'Bisa dicoba kirim lagi?');
        logErrorToFile(error);
    }
    await message.delete();
});

client.initialize();