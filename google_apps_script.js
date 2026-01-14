
/**
 * ShuttleUp Backend - Google Sheets API
 * Instructions:
 * 1. Create a Google Sheet.
 * 2. Create tabs: profiles, tournaments, teams, matches, credit_logs.
 * 3. Add headers to the first row of each tab (see keys in the code).
 * 4. Extensions > Apps Script > Paste this code.
 * 5. Deploy > New Deployment > Web App > Access: Anyone.
 */

function doPost(e) {
  const request = JSON.parse(e.postData.contents);
  const action = request.action;
  const params = request.params;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    let result;
    switch (action) {
      case 'AUTH_SIGNUP': result = signup(ss, params); break;
      case 'AUTH_SIGNIN': result = signin(ss, params); break;
      case 'SELECT': result = select(ss, params); break;
      case 'INSERT': result = insert(ss, params); break;
      case 'UPDATE': result = update(ss, params); break;
      case 'UPDATE_CREDITS': result = updateCredits(ss, params); break;
      default: throw new Error("Unknown action: " + action);
    }
    return ContentService.createTextOutput(JSON.stringify({ data: result, error: null }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ data: null, error: { message: err.message } }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetData(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function signup(ss, params) {
  const sheet = ss.getSheetByName('profiles');
  const users = getSheetData(sheet);
  if (users.find(u => u.username === params.username)) throw new Error("Username taken");
  
  const newUser = [
    Utilities.getUuid(),
    params.username,
    params.password,
    params.full_name,
    params.role || 'player',
    500, // Initial credits
    new Date().toISOString()
  ];
  sheet.appendRow(newUser);
  return { id: newUser[0], username: newUser[1] };
}

function signin(ss, params) {
  const sheet = ss.getSheetByName('profiles');
  const users = getSheetData(sheet);
  const user = users.find(u => u.username === params.username && u.password === params.password);
  if (!user) throw new Error("Invalid credentials");
  delete user.password;
  return user;
}

function select(ss, params) {
  const sheet = ss.getSheetByName(params.table);
  let data = getSheetData(sheet);
  if (params.filter) {
    data = data.filter(item => item[params.filter.col] == params.filter.val);
  }
  return data;
}

function insert(ss, params) {
  const sheet = ss.getSheetByName(params.table);
  const headers = sheet.getDataRange().getValues()[0];
  const newId = Utilities.getUuid();
  const timestamp = new Date().toISOString();
  
  const row = headers.map(h => {
    if (h === 'id') return newId;
    if (h === 'created_at') return timestamp;
    return params.data[h] || '';
  });
  
  sheet.appendRow(row);
  params.data.id = newId;
  params.data.created_at = timestamp;
  return params.data;
}

function update(ss, params) {
  const sheet = ss.getSheetByName(params.table);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] == params.id) {
      headers.forEach((h, j) => {
        if (params.updates[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(params.updates[h]);
        }
      });
      return true;
    }
  }
  return false;
}

function updateCredits(ss, params) {
  const sheet = ss.getSheetByName('profiles');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  const creditCol = headers.indexOf('credits');
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] == params.target_user_id) {
      const current = values[i][creditCol];
      sheet.getRange(i + 1, creditCol + 1).setValue(current + params.amount_change);
      
      // Log it
      const logSheet = ss.getSheetByName('credit_logs');
      logSheet.appendRow([Utilities.getUuid(), params.target_user_id, params.amount_change, params.log_action, params.log_description, new Date().toISOString()]);
      return true;
    }
  }
  throw new Error("User not found");
}
