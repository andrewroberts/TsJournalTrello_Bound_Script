var SCRIPT_NAME = 'TsJournalTrello_Bound_Script'
var SCRIPT_VERSION = 'v1.0'

function onOpen() {

  DocumentApp
    .getUi()
      .createMenu('TsJournalTrello')
        .addItem('Link Headers', 'linkHeaders')
        .addToUi()

} // onOpen()

function linkHeaders()  {
  TsJournalTrello.linkHeaders ({
    properties: PropertiesService.getScriptProperties(), 
    id: DocumentApp.getActiveDocument().getId()
  })
}
