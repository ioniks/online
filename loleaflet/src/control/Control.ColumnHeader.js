/*
* Control.ColumnHeader
*/

L.Control.ColumnHeader = L.Control.extend({
	onAdd: function () {
		var docContainer = L.DomUtil.get('document-container');
		var divHeader = L.DomUtil.create('div', 'spreadsheet-container-column', docContainer.parentElement);
		var tableContainer =  L.DomUtil.create('table', 'spreadsheet-container-table', divHeader);
		var tbodyContainer = L.DomUtil.create('tbody', '', tableContainer);
		var trContainer = L.DomUtil.create('tr', '', tbodyContainer);
		L.DomUtil.create('th', 'spreadsheet-container-th-corner', trContainer);
		var thColumns = L.DomUtil.create('th', 'spreadsheet-container-th-column', trContainer);
		var divInner = L.DomUtil.create('div', 'spreadsheet-container-column-inner', thColumns);
		this._table = L.DomUtil.create('table', '', divInner);
		this._table.id = 'spreadsheet-table-column';
		L.DomUtil.create('tbody', '', this._table);
		this._columns = L.DomUtil.create('tr', '', this._table.firstChild);

		this._position = 0;

		// dummy initial header
		L.DomUtil.create('th', 'spreadsheet-table-column-cell', this._columns);

		return document.createElement('div');
	},

	clearColumns : function () {
		L.DomUtil.remove(this._columns);
		this._columns = L.DomUtil.create('tr', '', this._table.firstChild);
	},


	setScrollPosition: function (position) {
		this._position = position;
		L.DomUtil.setStyle(this._table, 'left', this._position + 'px');
	},

	offsetScrollPosition: function (offset) {
		this._position = this._position - offset;
		L.DomUtil.setStyle(this._table, 'left', this._position + 'px');
	},

	fillColumns: function (columns, converter, context) {
		var twip, width, column;

		this.clearColumns();
		var totalWidth = -1; // beginning offset 1 due to lack of previous column
		for (var iterator = 0; iterator < columns.length; iterator++) {
			twip = new L.Point(parseInt(columns[iterator].size), parseInt(columns[iterator].size));
			width =  Math.round(converter.call(context, twip).x) - 2 - totalWidth;
			column = L.DomUtil.create('th', 'spreadsheet-table-column-cell', this._columns);
			column.innerHTML = columns[iterator].text;
			column.twipWidth = columns[iterator].size;
			column.width = width + 'px';
			totalWidth += width + 1;
		}
	},

	updateColumns: function (converter, context) {
		var iterator, twip, width, column;
		var totalWidth = -1;
		for (iterator = 0; iterator < this._columns.childNodes.length; iterator++) {
			column = this._columns.childNodes[iterator];
			twip = new L.Point(parseInt(column.twipWidth), parseInt(column.twipWidth));
			width =  Math.round(converter.call(context, twip).x) - 2 - totalWidth;
			column.width = width + 'px';
			totalWidth += width + 1;
		}
	}
});

L.control.columnHeader = function (options) {
	return new L.Control.ColumnHeader(options);
};
