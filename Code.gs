// Code.gs - File utama untuk web app TikTok Live Streaming

// Konfigurasi tetap
const CONFIG = {
  spreadsheetId: '<ID-SPREADSHEET>',  // Ganti dengan ID Spreadsheet Anda
  sheetName: 'tiktok_lives'
};

// Fungsi doGet - Entry point untuk web app
function doGet(e) {
  console.log('doGet dipanggil dengan parameter:', e);
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('TikTok Live Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Fungsi untuk memproses username TikTok atau URL live
function processLiveUrl(input) {
  console.log('processLiveUrl dipanggil dengan input:', input);
  try {
    // Menghapus spasi di awal dan akhir input
    input = input.trim();
    
    // Jika input langsung URL video (m3u8), kembalikan sebagai direct URL
    if (input.toLowerCase().includes('.m3u8')) {
      console.log('Input terdeteksi sebagai URL m3u8 langsung');
      return {
        success: true,
        data: {
          status: "ONLINE",
          roomId: "direct-" + Math.random().toString(36).substring(7),
          title: "TikTok Live Stream",
          nickname: "TikTok User",
          uniqueId: "tiktok_user",
          datetime: new Date().toLocaleString('id-ID'),
          liveUrl: input
        },
        liveUrl: input
      };
    }
    
    // Format username jika hanya menyediakan username tanpa @
    if (!input.includes('@') && !input.includes('tiktok.com')) {
      input = '@' + input;
    }
    
    // Format URL jika pengguna memberikan username atau username dengan @
    if (!input.includes('tiktok.com')) {
      input = 'https://www.tiktok.com/' + input + '/live';
    }
    
    // Pastikan URL berakhir dengan '/live' jika belum
    if (!input.endsWith('/live')) {
      input = input + '/live';
    }
    
    console.log('URL yang diproses:', input);
    
    // Langkah 1: Dapatkan room ID dari URL
    const roomId = getRoomId(input);
    console.log('Room ID yang didapatkan:', roomId);
    
    if (!roomId) {
      return {
        success: false,
        message: 'Tidak dapat menemukan Room ID TikTok. Pastikan username atau URL TikTok Live valid.'
      };
    }
    
    // Langkah 2: Ambil detail live stream dari API TikTok
    const liveDetails = fetchLiveDetails(roomId);
    console.log('Detail live yang didapatkan:', JSON.stringify(liveDetails).substring(0, 500) + '...');
    
    if (!liveDetails || !liveDetails.success) {
      return {
        success: false,
        message: liveDetails.message || 'Gagal mendapatkan detail live stream. Stream mungkin offline.'
      };
    }
    
    return liveDetails;
    
  } catch (error) {
    console.error('Error dalam processLiveUrl:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan: ' + error.toString()
    };
  }
}

// Mengambil Room ID dari URL TikTok Live
function getRoomId(liveUrl) {
  console.log('getRoomId dipanggil untuk URL:', liveUrl);
  try {
    // Ambil HTML halaman TikTok Live
    const response = UrlFetchApp.fetch(liveUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const responseCode = response.getResponseCode();
    console.log('Response code:', responseCode);
    
    if (responseCode !== 200) {
      console.error('Error saat mengambil URL TikTok. Response code:', responseCode);
      return null;
    }
    
    const html = response.getContentText();
    
    // Metode 1: Mencari roomId dalam HTML menggunakan regex
    let roomIdMatch = html.match(/roomId["\\s:=]+([0-9]+)/);
    if (roomIdMatch && roomIdMatch[1]) {
      return roomIdMatch[1];
    }
    
    // Metode 2: Mencoba format JSON lain
    roomIdMatch = html.match(/"roomId":"([0-9]+)"/);
    if (roomIdMatch && roomIdMatch[1]) {
      return roomIdMatch[1];
    }
    
    console.error('Room ID tidak ditemukan dalam HTML TikTok');
    return null;
    
  } catch (error) {
    console.error('Error dalam getRoomId:', error);
    return null;
  }
}

// Mengambil detail live stream dari API TikTok
function fetchLiveDetails(roomId) {
  console.log('fetchLiveDetails dipanggil untuk Room ID:', roomId);
  try {
    const apiUrl = `https://www.tiktok.com/api/live/detail/?aid=1988&roomID=${roomId}`;
    console.log('Mengakses API URL:', apiUrl);
    
    const response = UrlFetchApp.fetch(apiUrl, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const responseCode = response.getResponseCode();
    console.log('API response code:', responseCode);
    
    if (responseCode !== 200) {
      console.error('Error saat mengakses API TikTok. Response code:', responseCode);
      return {
        success: false,
        message: `API TikTok mengembalikan kode status ${responseCode}`
      };
    }
    
    const jsonResponse = JSON.parse(response.getContentText());
    console.log('API status_code:', jsonResponse.status_code);
    
    if (jsonResponse.status_code !== 0) {
      console.error('API TikTok mengembalikan status error:', jsonResponse.status_code);
      return {
        success: false,
        message: `API TikTok mengembalikan status code ${jsonResponse.status_code}`
      };
    }
    
    // Live stream status
    const status = jsonResponse.LiveRoomInfo.status;
    console.log('Live status:', status);
    
    if (status !== 2) {
      console.log('TikTok Live sedang offline');
      return {
        success: false,
        message: 'TikTok Live sedang offline. Coba lagi nanti.'
      };
    }
    
    // Jika live stream aktif, ambil URL stream
    const liveUrl = jsonResponse.LiveRoomInfo.liveUrl;
    console.log('Live URL ditemukan:', liveUrl);
    
    const now = new Date();
    const formattedDate = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedTime = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const formattedDateTime = `${formattedDate} pukul ${formattedTime}`;
    
    // Pastikan akses properti secara aman dengan optional chaining
    const ownerInfo = jsonResponse.LiveRoomInfo.ownerInfo || {};
    
    // Buat objek data yang terformat 
    const data = {
      status: "ONLINE",
      roomId: roomId,
      title: jsonResponse.LiveRoomInfo.title || "TikTok Live",
      nickname: ownerInfo.nickname || "TikTok User",
      uniqueId: ownerInfo.uniqueId || "",
      datetime: formattedDateTime,
      liveUrl: liveUrl,
      userCount: jsonResponse.LiveRoomInfo.userCount || 0,
      totalUserCount: jsonResponse.LiveRoomInfo.totalUserCount || 0,
      likeCount: jsonResponse.LiveRoomInfo.likeCount || 0,
      followInfo: ownerInfo.followInfo || {},
      coverUrl: jsonResponse.LiveRoomInfo.coverUrl || ""
    };
    
    return {
      success: true,
      data: data,
      liveUrl: liveUrl
    };
    
  } catch (error) {
    console.error('Error dalam fetchLiveDetails:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan: ' + error.toString()
    };
  }
}

// Fungsi untuk menyimpan data live stream ke spreadsheet
function saveLiveDataToSheet(liveData) {
  console.log('saveLiveDataToSheet dipanggil dengan data');
  try {
    // Gunakan ID spreadsheet dari konfigurasi
    const spreadsheetId = CONFIG.spreadsheetId;
    const sheetName = CONFIG.sheetName;
    
    console.log('Menggunakan spreadsheetId:', spreadsheetId, 'dan sheetName:', sheetName);
    
    if (!spreadsheetId || spreadsheetId === '<GANTI-DENGAN-ID-SPREADSHEET-ANDA>') {
      console.error('ID Spreadsheet belum ditentukan dalam konfigurasi');
      return {
        success: false,
        message: 'ID Spreadsheet belum ditentukan dalam konfigurasi'
      };
    }
    
    try {
      // Coba akses spreadsheet
      console.log('Mencoba mengakses spreadsheet dengan ID:', spreadsheetId);
      const ss = SpreadsheetApp.openById(spreadsheetId);
      
      // Cek apakah sheet ada, jika tidak buat baru
      let sheet;
      try {
        sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          console.log('Sheet tidak ditemukan, membuat sheet baru dengan nama:', sheetName);
          sheet = ss.insertSheet(sheetName);
          
          // Tambahkan header jika sheet baru
          const headers = [
            'Timestamp', 'Room ID', 'Status', 'Nickname', 'Unique ID', 
            'Title', 'User Count', 'Total User Count', 'Like Count', 
            'Live URL', 'Cover URL'
          ];
          sheet.appendRow(headers);
          sheet.setFrozenRows(1);
          
          // Format header
          sheet.getRange(1, 1, 1, headers.length).setBackground('#f5f5f5').setFontWeight('bold');
        }
      } catch (error) {
        console.error('Error saat mengakses sheet:', error);
        // Buat sheet baru jika error
        sheet = ss.insertSheet(sheetName);
        
        // Tambahkan header jika sheet baru
        const headers = [
          'Timestamp', 'Room ID', 'Status', 'Nickname', 'Unique ID', 
          'Title', 'User Count', 'Total User Count', 'Like Count', 
          'Live URL', 'Cover URL'
        ];
        sheet.appendRow(headers);
        sheet.setFrozenRows(1);
        
        // Format header
        sheet.getRange(1, 1, 1, headers.length).setBackground('#f5f5f5').setFontWeight('bold');
      }
      
      console.log('Menyimpan data baru ke spreadsheet');
      
      // Tambahkan data baru
      const rowData = [
        new Date(), // Timestamp
        liveData.roomId,
        liveData.status,
        liveData.nickname,
        liveData.uniqueId,
        liveData.title,
        liveData.userCount,
        liveData.totalUserCount,
        liveData.likeCount,
        liveData.liveUrl,
        liveData.coverUrl
      ];
      sheet.appendRow(rowData);
      
      // Auto-resize kolom agar semua konten terlihat
      sheet.autoResizeColumns(1, rowData.length);
      
      console.log('Data berhasil disimpan ke spreadsheet');
      
      return {
        success: true,
        message: 'Data berhasil disimpan ke spreadsheet'
      };
      
    } catch (error) {
      console.error('Error saat menyimpan ke spreadsheet:', error);
      return {
        success: false,
        message: 'Gagal menyimpan ke spreadsheet: ' + error.toString()
      };
    }
    
  } catch (error) {
    console.error('Error dalam saveLiveDataToSheet:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan: ' + error.toString()
    };
  }
}

// Fungsi untuk mendapatkan waktu eksekusi script (untuk analitik)
function getScriptExecutionTime() {
  console.log('getScriptExecutionTime dipanggil');
  return new Date().toISOString();
}
