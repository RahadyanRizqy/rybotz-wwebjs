const { Client, LocalAuth, MessageMedia }= require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const os = require('os');
const { format } = require('date-fns');
const { zonedTimeToUtc } = require('date-fns-tz');
const { uploadBase64Image, db, admin } = require('./upload');
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
        authStrategy: new LocalAuth({ clientId: `${clientId}`}),
    });
} else {
    client = new Client({
        puppeteer: {
            headless: true,
            args: [ '--no-sandbox', '--disable-setuid-sandbox' ]
        },
        ffmpeg: './ffmpeg.exe',
        authStrategy: new LocalAuth({ clientId: `${clientId}`}),
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
                db.ref(kelas).child(nim).child('hadir').child(`pertemuan${pertemuan}`).set(`${dest}/${formatFileName}`);
                uploadBase64Image(media.data, formatFileName, dest)
                    .then(async (result) => {
                        await chat.sendMessage(`*Kehadiran Praktikan PWEB Kelas ${kelas.toUpperCase()}*\nPertemuan Ke: ${pertemuan}\nTanggal: ${date}\nNIM: ${nim}\n\nSudah disimpan, jangan lupa hadir di pertemuan berikutnya! 😇👍`);
                    })
                    .catch((error) => {
                        throw error;
                    });
                // console.log(media.data);
                // const filename = path.join('./temp_uploads', formatFileName);
                // fs.writeFileSync(filename, media.data, 'base64');

                // if (kelas === 'C') {
                //     await uploadMediaToDrive('./temp_uploads', formatFileName, 'image/jpeg', '1lnJiHVWfnE2QGGwpwPPjpIdxuC4rNg-u');
                // }
                // if (kelas === 'A') {
                //     await uploadMediaToDrive('./temp_uploads', formatFileName, 'image/jpeg', '13gsqiGg8thqLNqNZVtE4rzd8JbODR6JY');
                // }



                // await fs.promises.unlink(filename);
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
                // const formatFileName = `${nim}_Perizinan Pertemuan ${pertemuan}_${datetime}` + '.' + media.mimetype.split('/')[1];
                // const filename = path.join('./temp_uploads', formatFileName);
                // fs.writeFileSync(filename, media.data, 'base64');

                // await uploadMedia('./temp_uploads', formatFileName, 'image/jpeg', '1k2xp4mrP7X47qaBZsNMhdboY1oRGjGOD');
            
                await chat.sendMessage(`*Perizinan Praktikan PWEB Kelas ${kelas}*\nPertemuan Ke: ${pertemuan}\nTanggal: ${date}\nNIM: ${nim}\nAlasan: ${alasan}\n\nSudah disimpan, jangan lupa untuk surat fisiknya ya! 😇👍`);
            }
            else {
                await chat.sendMessage(`*Perizinan Praktikan PWEB Kelas ${kelas}*\nPertemuan Ke: ${pertemuan}\nTanggal: ${date}\nNIM: ${nim}\nAlasan: ${alasan}\n\nSudah disimpan, jangan lupa untuk konfirmasi suratnya ke asprak ya!\nKarena suratnya nyusul! 😇👍`);
            }
        }

        if (messageBody[0] === 'id') {
            if (!kelas) {
                await chat.sendMessage('NIM tidak terdaftar!');
                return
            }
            chat.sendMessage(`Praktikan PWEB Kelas ${kelas.toUpperCase()}\nNIM: ${nim}\n\n*Terkonfirmasi!*`);
        }
    }
    catch (error) {
        await client.sendMessage(message.from, 'Bisa dicoba kirim lagi?');
        logErrorToFile(error);
    }
});

client.initialize();