// 34567890123456789012345678901234567890123456789012345678901234567890123456789

// JSHint - TODO
/* jshint asi: true */

(function() {"use strict"})()

// tsJournalTrello.gs
// ================
//
// Dev: AndrewRoberts.net
//
// External interface to this script - all of the event handlers.
//
// This files contains all of the event handlers, plus miscellaneous functions 
// not worthy of their own files yet
//
// The filename is prepended with _API as the Github chrome extension won't 
// push a file with the same name as the project.

var Log_

// Public event handlers
// ---------------------
//
// All external event handlers need to be top-level function calls; they can't 
// be part of an object, and to ensure they are all processed similarily 
// for things like logging and error handling, they all go through 
// errorHandler_(). These can be called from custom menus, web apps, 
// triggers, etc
// 
// The main functionality of a call is in a function with the same name but 
// post-fixed with an underscore (to indicate it is private to the script)
//
// For debug, rather than production builds, lower level functions are exposed
// in the menu

var EVENT_HANDLERS_ = {

//                           Name                            onError Message                          Main Functionality
//                           ----                            ---------------                          ------------------

  tsJournalTrello:                 ['tsJournalTrello()',                 'tsJournalTrello Failed',                     tsJournalTrello_],
}

function tsJournalTrello(args) {return eventHandler_(EVENT_HANDLERS_.tsJournalTrello, args)}

// Private Functions
// =================

// General
// -------

/**
 * All external function calls should call this to ensure standard 
 * processing - logging, errors, etc - is always done.
 *
 * @param {Array} config:
 *   [0] {Function} prefunction
 *   [1] {String} eventName
 *   [2] {String} onErrorMessage
 *   [3] {Function} mainFunction
 *
 * @param {Object}   args       The argument passed to the top-level event handler
 */

function eventHandler_(config, args) {

  try {

   var userEmail = Session.getActiveUser().getEmail()
   var logSheetId = PropertiesService.getScriptProperties().getProperty("LOG_SHEET_ID")
   
   Log_ = BBLog.getLog({
     level:                DEBUG_LOG_LEVEL_, 
     displayFunctionNames: DEBUG_LOG_DISPLAY_FUNCTION_NAMES_,
     sheetId:              logSheetId, //'1F17gbA3digJWgTM-qFI5sFDjmstzG3NwP4YKCheSfiA',
   })
    
   Log_.info('Handling ' + config[0] + ' from ' + (userEmail || 'unknown email') + ' (' + SCRIPT_NAME + ' ' + SCRIPT_VERSION + ')')
    
   // Call the main function
   return config[2](args)
    
  } catch (error) {

  var handleError = Assert.HandleError.DISPLAY_FULL

  if (!PRODUCTION_VERSION_) {
    handleError = Assert.HandleError.THROW
  }

  var assertConfig = {
    error:          error,
    userMessage:    config[1],
    log:            Log_,
    handleError:    handleError, 
    sendErrorEmail: SEND_ERROR_EMAIL_, 
    emailAddress:   ADMIN_EMAIL_ADDRESS_,
    scriptName:     SCRIPT_NAME,
    scriptVersion:  SCRIPT_VERSION,
    }

    Assert.handleError(assertConfig)
    }
    
    } // eventHandler_()

// Private event handlers
// ----------------------

/**
 *
 *
 * @param {object} 
 *
 * @return {object}
 */
 
function tsJournalTrello_(DocId) {

  Log_.functionEntryPoint()
  
  //Open the organisation spreadsheet
  var orgData = SpreadsheetApp.openById(ORG_ID_)
      .getSheetByName('Organisations')
      .getDataRange()
  
  var data = orgData.getValues()
  var timesheetUrl = null
  var trelloBoardUrl = null
  var trelloBoardId = null

  // Get the organisation name from the journal name, text before '- journal' 
  var str = ' - Journal'
  var CHAR_TO_END_ = str.length
  var orgName = DocumentApp.getActiveDocument().getName().slice(0, -CHAR_TO_END_)
  var orgFound = false
    
  //Loop through the rows of data
  var orgFound = data.some(function(row)  {
      
    //check if the company name matches the orgName
    var orgNameSearch = row[ORG_NAME_COL_]
      
    if (orgNameSearch === orgName) {
    
      //Get the timesheet and Trello Board Url
      timesheetUrl = row[ORG_TS_COL_]
      trelloBoardUrl = row[TRELLO_COL_]
      return true
      
      }
      
    })   
    
    if (orgFound === false) {
      Log_.warning('Organisation Name: ' + orgName + ' not found in Org Spreadsheet')
    } else {
      Log_.info('Organisation Name: ' + orgName + ' found in Org Spreadsheet')
    }
   
    
    //Check the Trello Board Exists  
    if (trelloBoardUrl === '') {
    
      Log_.warning('No Trello Board URL found in Org Spreadsheet')
      
      return
      
    } else {
      
      //Get the Trello Board Id from the wedsite json return
      try {
   
        var result = UrlFetchApp.fetch(trelloBoardUrl + '.json', {muteHttpExceptions:true})
        var response = result.getContentText()
        var trelloBoardData = JSON.parse(response) 
        trelloBoardId = trelloBoardData.id   
        
      } catch (error) {
    
        Log_.warning(trelloBoardUrl + ' not accessible: ' + error.message)
        return
        
      }
      
    
 
      //Open the Journal, loop through the paragraphs until the Heading 1 is found
      //The next paragraph is the Trello Card Name, check it hasnt already been processed.
      //If it hasnt, change the style to Heading 2 and add a Hyperlink to the Trello Card 
      var journal = DocumentApp.openById(DocId)
      var DocUrl = journal.getUrl()
      var npBookmark = null
      var trelloCardTitle = null
 
      if (journal === null) { 
  
        Log_.warning('Invalid Journal ID' + DocId)
   
        return
    
      } else {
  
        var pars = journal.getBody().getParagraphs()
  
        for(var i in pars) {
  
          //If the paragraph is Heading 1 get the next paragraph, which will be the trello card title
          if (pars[i].getHeading() === DocumentApp.ParagraphHeading.HEADING1) {

            var nextPar = pars[Number(i) + 1]
            var nextParText = nextPar.getText()

      
            if (nextPar.getHeading() !== DocumentApp.ParagraphHeading.HEADING2) {
              Log_.info('New Trello Card Title found: ' + nextParText)
          
              //Store the text as the Trello Card Title
              trelloCardTitle = nextParText
      
              //Get the Url from the card title, add the link to the journal
              var trelloCardUrl = getTrelloCardUrl(trelloBoardId, trelloCardTitle)
      
              if (trelloCardUrl === null) {
        
                Log_.warning('Trello card not found in trello board')
          
              } else {
        
                //add a bookmark at the position of the paragraph
                var sectionPos = journal.newPosition(nextPar, 0);
                npBookmark = journal.addBookmark(sectionPos)
        
                // Set the next paragraph to heading 2 and add the Trello Card Title URL link
                nextPar.setHeading(DocumentApp.ParagraphHeading.HEADING2)
                nextPar.setLinkUrl(trelloCardUrl)
          
                //Add the link to the timesheet
                if (timesheetUrl === '') {

                  Log_.warning('No Timesheet URL found in Org Spreadsheet')
                  return
    
                } else {
  
                  //Get the last row with data in the Date column, use this to add the Trello Card and 
                  //Journal URL link to the timesheet
                  var timeSheet = SpreadsheetApp.openByUrl(timesheetUrl).getSheetByName('Timesheet')
                  var tsDate = timeSheet.getRange(DATE_COL_).getValues()
                  var lastTsRow = tsDate.filter(String).length 
    
                  //Get the last timesheet row and add the link to the journal heading
                  var timesheetTask = timeSheet.getRange(lastTsRow, TIMESHEET_COL_)
    
                  if (npBookmark === null) {
    
                    Log_.warning('No Bookmark URL found Journal' + DocUrl + ' or no new journal entry')
        
                  } else {
    
                    var cellValue = timesheetTask.getValue()
      
                    if (cellValue !== '') {
      
                      Logger.log('Data found in Timesheet Notes, clear the Task/Notes cell and try again')
        
                    } else {
      
                      timesheetTask.setFormula('=HYPERLINK("' + DocUrl + '#bookmark=' + npBookmark.getId() + '", " ' + trelloCardTitle + '")')
      
                    }
                      Log_.info('Timesheet URL: ' + timesheetUrl)
                      Log_.info('Journal URL: ' + DocUrl +  npBookmark.getId())
                  }
                }
              }
            }     
          }
        }
      return SUCCESS
    }
  } 
}// tsJournalTrello() 

function getTrelloCardUrl(trelloBoardId, trelloCardTitle) {
  
  //Get the JSON response of the Trello Board
  var API_KEY = PropertiesService.getScriptProperties().getProperty("API_KEY")
  var TOKEN = PropertiesService.getScriptProperties().getProperty("TOKEN")
  var url = "https://api.trello.com/1/boards/" + trelloBoardId + "/cards/?fields=name,url&key=" + API_KEY + "&token=" + TOKEN
  var response = UrlFetchApp.fetch(url).getContentText()
  var trelloCardUrl = null
  
  var obj = JSON.parse(response)
        
  //Find the card title in the list of board cards   
  for (var key in obj) {
  
    if (obj[key].name === trelloCardTitle) {
    
      trelloCardUrl = obj[key].url
      Log_.info('Trellocard URL: ' + trelloCardUrl)
      return trelloCardUrl
      
    } 
    
  }
 
  if (trelloCardUrl === null) {
  
    Log_.warning('Card Name ' + trelloCardTitle + ' not found in list of Trello Boards')
    
    return null
    
  } else {
    return trelloCardUrl
  }
  
}