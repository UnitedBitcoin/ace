define(function (require, exports, module) {
    "use strict";

    var oop = require("../../lib/oop");
    var BaseFoldMode = require("./fold_mode").FoldMode;
    var Range = require("../../range").Range;
    var TokenIterator = require("../../token_iterator").TokenIterator;


    var FoldMode = exports.FoldMode = function () { };

    oop.inherits(FoldMode, BaseFoldMode);

    (function () {

        this.foldingStartMarker = /\b(begin_const|begin_upvalue|begin_code)\b|{\s*$|;/;
        this.foldingStopMarker = /\b(end_const|end_upvalue|end_code)\b|{\s*$|;/;

        this.getFoldWidget = function (session, foldStyle, row) {
            var line = session.getLine(row);
            var isStart = this.foldingStartMarker.test(line);
            var isEnd = this.foldingStopMarker.test(line);

            if (isStart && !isEnd) {
                var match = line.match(this.foldingStartMarker);
                if (match.length >= 2 && match[1] && match[1].indexOf('begin_') === 0)
                    return 'start';
            }
            if (isEnd) {
                var match = line.match(this.foldingStopMarker);
                if (match.length >= 2 && match[1] && match[1].indexOf('end_') === 0)
                    return 'end';
            }
            return "";
        };

        this.getFoldWidgetRange = function (session, foldStyle, row) {
            var line = session.doc.getLine(row);
            var match = this.foldingStartMarker.exec(line);
            if (match) {
                if (match[1])
                    return this.uvmsBlock(session, row, match.index + 1);

                if (match[2])
                    return session.getCommentFoldRange(row, match.index + 1);

                return this.openingBracketBlock(session, "{", row, match.index);
            }

            var match = this.foldingStopMarker.exec(line);
            if (match) {
                if (match[0] === "end") {
                    if (session.getTokenAt(row, match.index + 1).type === "keyword")
                        return this.uvmsBlock(session, row, match.index + 1);
                }

                if (match[0][0] === "]")
                    return session.getCommentFoldRange(row, match.index + 1);

                return this.closingBracketBlock(session, "}", row, match.index + match[0].length);
            }
        };

        this.uvmsBlock = function (session, row, column) {
            var stream = new TokenIterator(session, row, column);
            var indentKeywords = {
                "begin_const": 1,
                "begin_upvalue": 1,
                "begin_code": 1,
            };
            var outdentKeywords = {
                "end_const": 1,
                "end_upvalue": 1,
                "end_code": 1,
            }

            var token = stream.getCurrentToken();
            // TODO: .symbol
            if (!token || (token.type != "keyword" & token.type !== 'identifier'))
                return;

            var val = token.value || token.name;
            var stack = [val];
            var dir = indentKeywords[val];

            if (!dir)
                return;

            var startColumn = dir === -1 ? stream.getCurrentTokenColumn() : session.getLine(row).length;
            var startRow = row;

            stream.step = dir === -1 ? stream.stepBackward : stream.stepForward;
            while (token = stream.step()) {
                if (token.type !== "keyword" && token.type !== 'identifier')
                    continue;
                if (!indentKeywords[token.value || token.name]) {
                    if (outdentKeywords[token.value || token.name]) {
                        var row = stream.getCurrentTokenRow();
                        if (dir === -1)
                            return new Range(row, session.getLine(row).length, startRow, startColumn);
                        else
                            return new Range(startRow, startColumn, row, stream.getCurrentTokenColumn());
                    } else {
                        continue
                    }
                }
                var level = dir * indentKeywords[token.value || token.name];

                if (level > 0) {
                    stack.unshift(token.value || token.name);
                } else if (level <= 0) {
                    stack.shift();
                    if (!stack.length && (token.value || token.name) != "elseif")
                        break;
                    if (level === 0)
                        stack.unshift(token.value || token.name);
                }
            }

            var row = stream.getCurrentTokenRow();
            if (dir === -1)
                return new Range(row, session.getLine(row).length, startRow, startColumn);
            else
                return new Range(startRow, startColumn, row, stream.getCurrentTokenColumn());
        };

    }).call(FoldMode.prototype);

});
