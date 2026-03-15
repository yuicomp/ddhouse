// ===================================================
// D.D.HOUSE スロット集計 - GAS バックエンド
// ===================================================

var SHEET = {
  SETTINGS: '設定',
  PRIZES: '賞マスタ',
  SHOPS: '店舗マスタ',
  LOGS: 'ログ',
};

// ---- ルーティング ----

function doGet(e) {
  var action = e.parameter.action;
  var result;
  try {
    if (action === 'auth') {
      result = handleAuth(e.parameter.id, e.parameter.pass);
    } else if (action === 'getSettings') {
      result = handleGetSettings();
    } else if (action === 'getLogs') {
      result = handleGetLogs(e.parameter.date);
    } else {
      result = { success: false, error: '不明なアクション: ' + action };
    }
  } catch (err) {
    result = { success: false, error: String(err) };
  }
  return output(result);
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var result;
  try {
    switch (data.action) {
      case 'appendLogs':    result = handleAppendLogs(data.logs); break;
      case 'updateStore':   result = handleUpdateStore(data.store); break;
      case 'deleteStore':   result = handleDeleteStore(data.store_id); break;
      case 'updatePrizes':  result = handleUpdatePrizes(data.prizes); break;
      default:
        result = { success: false, error: '不明なアクション: ' + data.action };
    }
  } catch (err) {
    result = { success: false, error: String(err) };
  }
  return output(result);
}

function output(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- 設定ヘルパー ----

function getSettingsMap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.SETTINGS);
  if (!sheet) return {};
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) map[data[i][0]] = data[i][1];
  }
  return map;
}

function setSettingValue(key, value) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.SETTINGS);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// ---- 認証 ----

function handleAuth(id, pass) {
  var settings = getSettingsMap();
  var i = 1;
  while (settings['auth_id_' + i] !== undefined) {
    if (String(settings['auth_id_' + i]) === String(id) &&
        String(settings['auth_pass_' + i]) === String(pass)) {
      return { success: true };
    }
    i++;
  }
  // フォールバック: 設定が空の場合は初期値で認証
  if (i === 1 && id === 'ipad1' && pass === 'ddhouse') {
    return { success: true };
  }
  return { success: false, error: 'IDまたはパスワードが違います' };
}

// ---- 設定取得 ----

function handleGetSettings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 賞マスタ
  var prizesSheet = ss.getSheetByName(SHEET.PRIZES);
  var prizes = [];
  if (prizesSheet) {
    var prizesData = prizesSheet.getDataRange().getValues();
    for (var i = 1; i < prizesData.length; i++) {
      if (prizesData[i][0]) {
        prizes.push({
          prize_id: String(prizesData[i][0]),
          name: String(prizesData[i][1]),
          order: Number(prizesData[i][2]),
        });
      }
    }
  }

  // 店舗マスタ
  var shopsSheet = ss.getSheetByName(SHEET.SHOPS);
  var shops = [];
  if (shopsSheet) {
    var shopsData = shopsSheet.getDataRange().getValues();
    for (var j = 1; j < shopsData.length; j++) {
      if (shopsData[j][0]) {
        shops.push({
          store_id: String(shopsData[j][0]),
          name: String(shopsData[j][1]),
          floor: String(shopsData[j][2]),
        });
      }
    }
  }

  return { success: true, prizes: prizes, shops: shops };
}

// ---- ログ取得 ----

function handleGetLogs(date) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.LOGS);
  if (!sheet) return { success: true, logs: [] };

  var data = sheet.getDataRange().getValues();
  var logs = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var timestamp = String(data[i][3]);
    if (date && !timestamp.startsWith(date)) continue;
    var prizesRaw = data[i][9];
    var prizes = {};
    try { prizes = JSON.parse(String(prizesRaw)); } catch (e) {}
    logs.push({
      log_id: String(data[i][0]),
      device_id: String(data[i][1]),
      device_label: String(data[i][2]),
      timestamp: timestamp,
      store_id: String(data[i][4]),
      store_name: String(data[i][5]),
      floor: String(data[i][6]),
      receipt_amount: Number(data[i][7]),
      slot_count: Number(data[i][8]),
      prizes: prizes,
      synced: true,
      from_remote: true,
    });
  }
  return { success: true, logs: logs };
}

// ---- ログ追記 ----

function handleAppendLogs(logs) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET.LOGS);
    if (!sheet) throw new Error('ログシートが見つかりません。シート名「ログ」を作成してください。');

    // 既存IDを取得
    var existingData = sheet.getDataRange().getValues();
    var existingIds = {};
    for (var i = 1; i < existingData.length; i++) {
      if (existingData[i][0]) existingIds[existingData[i][0]] = true;
    }

    var newRows = [];
    var allTimestamps = [];

    for (var j = 0; j < logs.length; j++) {
      var log = logs[j];
      if (existingIds[log.log_id]) continue;
      newRows.push([
        log.log_id,
        log.device_id,
        log.device_label,
        log.timestamp,
        log.store_id,
        log.store_name,
        log.floor,
        log.receipt_amount,
        log.slot_count,
        JSON.stringify(log.prizes),
      ]);
      allTimestamps.push(log.timestamp);
    }

    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 10).setValues(newRows);
    }

    // 稼働時間を更新
    if (allTimestamps.length > 0) {
      updateOperatingTime(allTimestamps);
    }

    return { success: true, added: newRows.length };
  } finally {
    lock.releaseLock();
  }
}

// ---- 稼働時間更新 ----

function updateOperatingTime(timestamps) {
  var times = timestamps.map(function(ts) {
    var d = new Date(ts);
    // JSTに変換
    var jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    var h = ('0' + jst.getUTCHours()).slice(-2);
    var m = ('0' + jst.getUTCMinutes()).slice(-2);
    return h + ':' + m;
  });
  times.sort();
  var minTime = times[0];
  var maxTime = times[times.length - 1];

  var settings = getSettingsMap();
  var curStart = settings['operating_start'] || '';
  var curEnd = settings['operating_end'] || '';

  if (!curStart || minTime < curStart) setSettingValue('operating_start', minTime);
  if (!curEnd || maxTime > curEnd) setSettingValue('operating_end', maxTime);
}

// ---- 店舗マスタ更新 ----

function handleUpdateStore(store) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET.SHOPS);
    if (!sheet) throw new Error('店舗マスタシートが見つかりません');

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === store.store_id) {
        sheet.getRange(i + 1, 1, 1, 3).setValues([[store.store_id, store.name, store.floor]]);
        return { success: true };
      }
    }
    sheet.appendRow([store.store_id, store.name, store.floor]);
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

// ---- 店舗削除 ----

function handleDeleteStore(store_id) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET.SHOPS);
    if (!sheet) throw new Error('店舗マスタシートが見つかりません');

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === store_id) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: '店舗が見つかりません' };
  } finally {
    lock.releaseLock();
  }
}

// ---- 賞マスタ更新 ----

function handleUpdatePrizes(prizes) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET.PRIZES);
    if (!sheet) throw new Error('賞マスタシートが見つかりません');

    sheet.clearContents();
    sheet.appendRow(['prize_id', 'name', 'order']);
    for (var i = 0; i < prizes.length; i++) {
      sheet.appendRow([prizes[i].prize_id, prizes[i].name, prizes[i].order]);
    }
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

// ====================================================
// 初期セットアップ用関数（手動実行）
// Apps Script エディタから「setupSheets」を実行してください
// ====================================================

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 設定シート
  var settingsSheet = ss.getSheetByName(SHEET.SETTINGS) || ss.insertSheet(SHEET.SETTINGS);
  settingsSheet.clearContents();
  settingsSheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  settingsSheet.getRange(2, 1, 6, 2).setValues([
    ['operating_start', ''],
    ['operating_end', ''],
    ['auth_id_1', 'ipad1'],
    ['auth_pass_1', 'ddhouse'],
    ['auth_id_2', ''],
    ['auth_pass_2', ''],
  ]);
  settingsSheet.setFrozenRows(1);

  // 賞マスタ
  var prizesSheet = ss.getSheetByName(SHEET.PRIZES) || ss.insertSheet(SHEET.PRIZES);
  prizesSheet.clearContents();
  prizesSheet.getRange(1, 1, 1, 3).setValues([['prize_id', 'name', 'order']]);
  prizesSheet.getRange(2, 1, 3, 3).setValues([
    ['p1', '1等', 1],
    ['p2', '2等', 2],
    ['p3', 'ラッキー賞', 3],
  ]);
  prizesSheet.setFrozenRows(1);

  // 店舗マスタ
  var shopsSheet = ss.getSheetByName(SHEET.SHOPS) || ss.insertSheet(SHEET.SHOPS);
  shopsSheet.clearContents();
  shopsSheet.getRange(1, 1, 1, 3).setValues([['store_id', 'name', 'floor']]);
  var initialShops = [
    ['s001','サカバダ アレグロ','B1F'],
    ['s002','地酒蔵 大阪 JIZAKE KURA OSAKA','B1F'],
    ['s003','韓国酒場コッキオ＋サムギョプサル','B1F'],
    ['s004','揚げたてねりもん おでんのじんべえ','B1F'],
    ['s005','板前焼肉 一笑','B1F'],
    ['s006','ゴールデン タイガー','B1F'],
    ['s007','権之介 梅田','B1F'],
    ['s008','博多もつ鍋 おおやま','B1F'],
    ['s009','酒友 はなび','B1F'],
    ['s010','串カツ田中','B1F'],
    ['s011','daily dose coffee','B1F'],
    ['s012','めっちゃAbuRu yan','B1F'],
    ['s013','LEMONADE DISCO','B1F'],
    ['s014','メディアカフェポパイ','B1F'],
    ['s015','すすきの大衆酒場 白いたぬきホール','1F'],
    ['s016','幻想の国のアリス','1F'],
    ['s017','薩摩ごかもん','1F'],
    ['s018','新阪急ホテルアネックス（カフェ・クレール）','1F'],
    ['s019','えびそば 一幻','1F'],
    ['s020','BIG ECHO','2F'],
    ['s021','大衆酒場 ボナパルト・ブルー','2F'],
    ['s022','大衆酒場 どんがめ（2階店）','2F'],
    ['s023','鳥貴族','2F'],
    ['s024','ANDRE','2F'],
    ['s025','海鮮屋台おくまん','2F'],
    ['s026','FreeEntertainmentSpace [fés]','2F'],
    ['s027','Bar moonwalk','2F'],
    ['s028','忘我スタジアム','3F'],
    ['s029','恋愛酒場メイ子','3F'],
    ['s030','大衆酒場 どんがめ（3階店）','3F'],
    ['s031','エッジオリジネーション/エッジアイ','3F'],
  ];
  shopsSheet.getRange(2, 1, initialShops.length, 3).setValues(initialShops);
  shopsSheet.setFrozenRows(1);

  // ログシート
  var logsSheet = ss.getSheetByName(SHEET.LOGS) || ss.insertSheet(SHEET.LOGS);
  logsSheet.clearContents();
  logsSheet.getRange(1, 1, 1, 10).setValues([[
    'log_id', 'device_id', 'device_label', 'timestamp',
    'store_id', 'store_name', 'floor',
    'receipt_amount', 'slot_count', 'prizes(JSON)'
  ]]);
  logsSheet.setFrozenRows(1);

  // 列幅調整
  SpreadsheetApp.flush();
  Logger.log('✅ セットアップ完了！シートが4枚作成されました。');
}
