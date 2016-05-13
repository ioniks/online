/*
* Control.ContextMenu
*/

/* global */
L.Control.ContextMenu = L.Control.extend({
	options: {
		SEPERATOR: '---------',
		/*
		 * Enter UNO commands that should appear in the context menu.
		 * Entering a UNO command under `general' would enable it for all types
		 * of documents. If you do not want that, whitelist it in document specific filter.
		 */
		whitelist: {
			general: ['Cut', 'Copy', 'Paste', 'PasteSpecialMenu', 'PasteUnformatted',
					  'NumberingStart', 'ContinueNumbering', 'IncrementLevel', 'DecrementLevel',
					  'OpenHyperlinkLocation', 'CopyHyperlinkLocation', 'RemoveHyperlink',
					  'ArrangeFrameMenu', 'ArrangeMenu', 'BringToFront', 'ObjectForwardOne', 'ObjectBackOne', 'SendToBack',
					  'RotateMenu', 'RotateLeft', 'RotateRight'],

			text: ['TableInsertMenu',
				   'InsertRowsBefore', 'InsertRowsAfter', 'InsertColumnsBefore', 'InsertColumnsAfter',
				   'TableDeleteMenu',
				   'DeleteRows', 'DeleteColumns', 'DeleteTable',
				   'MergeCells', 'SetOptimalColumnWidth', 'SetOptimalRowWidth'],

			spreadsheet: ['MergeCells', 'SplitCells',
						  'InsertAnnotation', 'EditAnnotation', 'DeleteNote', 'ShowNote', 'HideNote'],

			presentation: [],
			drawing: []
		}
	},



	onAdd: function (map) {
		this._prevMousePos = null;

		map.on('locontextmenu', this._onContextMenu, this);
		map.on('mousedown', this._onMouseDown, this);
	},

	_onMouseDown: function(e) {
		this._prevMousePos = {x: e.originalEvent.pageX, y: e.originalEvent.pageY};

		$.contextMenu('destroy', '.leaflet-layer');
	},

	_onContextMenu: function(obj) {
		if (!map._editlock) {
			return;
		}

		var contextMenu = this._createContextMenuStructure(obj);
		var d = $.contextMenu({
			selector: '.leaflet-layer',
			trigger: 'none',
			build: function(triggerEle, e) {
				return {
					callback: function(key, options) {
						map.sendUnoCommand(key);
					},
					items: contextMenu
				};
			}
		});

		$('.leaflet-layer').contextMenu(this._prevMousePos);
	},

	_createContextMenuStructure: function(obj) {
		var docType = map.getDocType();
		var contextMenu = {};
		var sepIdx = 1, itemName;
		var isLastItemText = false;
		for (var idx in obj['menu']) {
			var item = obj['menu'][idx];
			if (item['enabled'] === 'false') {
				continue;
			}

			if (item['type'] === 'separator') {
				if (isLastItemText) {
					contextMenu['sep' + sepIdx++] = this.options.SEPERATOR;
				}
				isLastItemText = false;
			}
			else {
				// Only show whitelisted items
				// Command name (excluding '.uno:') starts from index = 5
				var commandName = item['command'].substring(5);
				if (this.options.whitelist.general.indexOf(commandName) === -1 &&
					!(docType === 'text' && this.options.whitelist.text.indexOf(commandName) !== -1) &&
					!(docType === 'spreadsheet' && this.options.whitelist.spreadsheet.indexOf(commandName) !== -1) &&
					!(docType === 'presentation' && this.options.whitelist.presentation.indexOf(commandName) !== -1) &&
					!(docType === 'drawing' && this.optinos.whitelist.drawing.indexOf(commandName) !== -1)) {
					continue;
				}

				if (item['type'] === 'command') {
					itemName = item['text'].replace('~', '');
					contextMenu[item['command']] = {
						name: itemName
					};

					if (item['checktype'] === 'checkmark') {
						if (item['checked'] === 'true') {
							contextMenu[item['command']]['icon'] = 'checkmark';
						}
					} else if (item['checktype'] === 'radio') {
						if (item['checked'] === 'true') {
							contextMenu[item['command']]['icon'] = 'radio';
						}
					}

					isLastItemText = true;
				} else if (item['type'] === 'menu') {
					itemName = item['text'].replace('~', '');
					var submenu = this._createContextMenuStructure(item);
					// ignore submenus with all items disabled
					if (Object.keys(submenu).length === 0) {
						continue;
					}

					contextMenu[item['command']] = {
						name: itemName,
						items: submenu
					};
					isLastItemText = true;
				}
			}

		}

		// Remove seperator, if present, in the end
		var lastItem = Object.keys(contextMenu)[Object.keys(contextMenu).length - 1];
		if (lastItem !== undefined && lastItem.startsWith('sep')) {
			delete contextMenu[lastItem];
		}

		return contextMenu;
	}
});

L.control.contextMenu = function (options) {
	return new L.Control.ContextMenu(options);
};