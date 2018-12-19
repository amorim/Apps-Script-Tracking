function doGet() {
  var out = HtmlService.createHtmlOutputFromFile('front'); 
  out.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  out.setTitle('Front');
  return out;
}

function getTrackingFunctionByUrl(url) {
  if (url.indexOf("directlog") != -1) {
    return directLog;
  }
  else if (url.indexOf("totalexpress") != -1) {
    return tex;
  }
  else if (url.indexOf("jadlog") != -1) {
    return jadlog;
  }
  else if (url.indexOf("rapidaocometa") != -1) {
    return rc;  
  }
  return undefined;
}

function addNewItem(itemname, itemurl) {
  try {
    var call = getTrackingFunctionByUrl(itemurl);
    if (!call)
      return undefined;
    var item = call(itemurl);
    item.id = Utilities.getUuid();
    item.name = itemname;
    item.url = itemurl;
    saveNewItemToFirebase(item);
    return item;
  }
  catch (error) {
   return undefined; 
  }
}

function saveNewItemToFirebase(item) {
  var fb = getFbInstance();
  var alldata = fb.getData("/");
  if (!alldata)
    alldata = [];
  alldata.push(item);
  fb.setData("/", alldata);
}

function deleteItem(itemId) {
  var data = loadAllItems();
  for (var i = data.length - 1; i >= 0; i--) {
    var item = data[i];
    if (item.id == itemId) {
       data.splice(i, 1);
        var fb = getFbInstance();
        fb.setData("/", data);
       return itemId;
    }
  }
  return undefined;
}

function loadAllItems() {
  var fb = getFbInstance();
  return fb.getData("/");
}

function getFbInstance() {
 var token = ScriptApp.getOAuthToken();
 return FirebaseApp.getDatabaseByUrl("your realtime database url", token); 
}


function updateEverything() {
  var items = loadAllItems();
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    try {
       var call = getTrackingFunctionByUrl(item.url);
       var upditem = call(item.url, item);
      if (upditem.lastStatus != item.lastStatus) {
        upditem.name = item.name;
        upditem.url = item.url;
        upditem.id = item.id;
        items[i] = upditem;
       sendEmail(upditem);
      }
    } catch (error) {
     // Error 
    }
  }
  var fb = getFbInstance();
  fb.setData("/", items);
}

function sendEmail(item) {
  GmailApp.sendEmail("youremail", "Atualização Rastreio " + item.name, "O rastreio de " + item.name + " foi atualizado. O status mais novo é " + item.lastStatus + ". Visite o front para mais informações."); 
}


function directLog(url) {
  var html = UrlFetchApp.fetch(url).getContentText("ISO-8859-1");
  var array = html.split('td width="100%" valign=top')[1].split('table border=0 width="95%"')[1].split('<tr style="font-family:Verdana');
  var arrretorno = [];
  for (var i = 1; i < array.length; i++) {
    var obj = {};
    var cols = array[i].split('<td');
    Logger.log(cols);
    obj.date = cols[1].split('<b>')[1].split('</b>')[0] + ' - ' + cols[2].split('<b>')[1].split('</b>')[0];
    obj.status = cols[3].split('<b>')[1].split('<br>')[0] + ' (' + cols[4].split('<b>')[1].split('<br>')[0] + ')';
    arrretorno.push(obj);
  }
  var item = {};
  item.lastStatus = arrretorno[arrretorno.length - 1].status;
  item.tracking = arrretorno;
  return item;
}

function tex(url) {
  var html = UrlFetchApp.fetch(url).getContentText("ISO-8859-1");
  var arrretorno = [];
  var data = html.split('<table width="60')[1];
  if (!data) {
    var obj = {};
    obj.date = 'N/A';
    obj.status = "Rastro ainda não disponível";
    arrretorno.push(obj);
    var item = {};
  item.lastStatus = arrretorno[arrretorno.length - 1].status;
  item.tracking = arrretorno;
  return item;
  }
  var array = data.split('<tr');
  
  for (var i = 2; i < array.length; i++) {
    var obj = {};
    var cols = array[i].split('<td');
    obj.status = cols[3].split('">')[2].split('</font>')[0].trim();
    obj.date = cols[1].split('">')[2].split('</font>')[0].trim() + ' - ' + cols[2].split('">')[2].split('</font>')[0].trim();
    arrretorno.push(obj);
  }
  var item = {};
  item.lastStatus = arrretorno[arrretorno.length - 1].status;
  item.tracking = arrretorno;
  return item;
}

function jadlog(url) {
 var html = UrlFetchApp.fetch(url).getContentText("ISO-8859-1");
  var arrretorno = [];
  var data = html.split('tbody')[1];
  var array = data.split('<tr');
  for (var i = 2; i < array.length; i++) {
    var obj = {};
    var cols = array[i].split('<td');
    obj.date = cols[1].split('bold">')[1].split('</span>')[0];
    obj.status = cols[3].split('bold">')[1].split('</span>')[0] + "(" + cols[4].split('#a90034;">')[1].split('</span>')[0] + ")";
    arrretorno.push(obj);
  }
  var item = {};
  item.lastStatus = arrretorno[arrretorno.length - 1].status;
  item.tracking = arrretorno;
  return item;
}

function rc(url, item) {
  var html = UrlFetchApp.fetch(url).getContentText("ISO-8859-1");
  var data = getTextFromHtml(html.split('Rota: ')[1].split('</td>')[0].trim());
  if (!item) {
    return { lastStatus: data, tracking: [{date: 'N/A', status: data}] };
  }
  var copy = JSON.parse(JSON.stringify(item));
  if (copy.lastStatus != data) {
      copy.tracking.push({date: 'N/A', status: data});
      copy.lastStatus = data;
  }
  return copy;
}

function getTextFromHtml(html) {
  return getTextFromNode(Xml.parse(html, true).getElement());
}

function getTextFromNode(x) {
  switch(x.toString()) {
    case 'XmlText': 
      return x.toXmlString();
    case 'XmlElement': 
      return x.getNodes().map(getTextFromNode).join('');
    default: 
      return '';
  }
}
