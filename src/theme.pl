:- module(theme, [
    ui_color/3,
    token_style/5,
    semantic_color/4,
    decoration_style/3
]).

hue(coral,   25).
hue(orange,  55).
hue(gold,    85).
hue(green,  150).
hue(aqua,   175).
hue(cyan,   195).
hue(sky,    235).
hue(blue,   250).
hue(purple, 300).
hue(magenta, 320).
hue(neutral, 85).

alpha(hint,   0.15).
alpha(soft,   0.30).
alpha(medium, 0.45).
alpha(strong, 0.60).

% Syntax
color(fg(comment),       gold).
color(fg(doc_comment),   orange).
color(fg(keyword),       neutral).
color(fg(function),      blue).
color(fg(function_decl), blue).
color(fg(string),        gold).
color(fg(interpolation), aqua).
color(fg(regex),         cyan).
color(fg(number),        coral).
%color(fg(constant),      purple).
color(fg(variable),      gold).
color(fg(property),      gold).
color(fg(type),          sky).
color(fg(interface),     aqua).
color(fg(operator),      neutral).
color(fg(punctuation),   gold).
color(fg(tag),           green).
color(fg(attribute),     gold).
color(fg(decorator),     gold).
color(fg(escape),        magenta).
color(fg(special_var),   magenta).
color(fg(invalid),       coral).

color(bg(keyword),       green).
color(bg(function),      blue).
color(bg(function_decl), blue).
color(bg(constant),      gold).
%color(bg(variable),      gold).
color(bg(type),          sky).
color(bg(invalid),       coral).

alpha(bg(keyword),       soft).
alpha(bg(function),      hint).
alpha(bg(function_decl), hint).
alpha(bg(constant),      hint).
alpha(bg(variable),      hint).
alpha(bg(type),          hint).
alpha(bg(invalid),       soft).

% UI semantic groups
color(fg(text),     neutral).
color(fg(muted),    neutral).
color(fg(subtle),   neutral).
color(fg(error),    coral).
color(fg(warning),  gold).
color(fg(info),     blue).
color(fg(added),    green).
color(fg(modified), gold).
color(fg(deleted),  coral).
color(fg(conflict), magenta).
color(fg(focus),    gold).
color(fg(match),    gold).
color(fg(bracket),  green).

color(bg(base),      neutral).
color(bg(surface),   neutral).
color(bg(raised),    neutral).
color(bg(selection), blue).
color(fg(selection), blue).
color(bg(highlight), blue).
color(bg(match),     gold).
color(bg(bracket),   green).

alpha(bg(selection), soft).
alpha(bg(highlight), hint).
alpha(bg(match),     medium).
alpha(bg(bracket),   hint).

% Lightness overrides for neutral groups
lightness(fg(text),   95).
lightness(fg(muted),  45).
lightness(fg(subtle), 70).
lightness(bg(base),    0).
lightness(bg(surface), 7).
lightness(bg(raised), 14).

bold(comment).
bold(doc_comment).
bold(function_decl).

scope(comment, 'comment').
scope(comment, 'punctuation.definition.comment').
scope(doc_comment, 'comment.block.documentation').
scope(doc_comment, 'comment.block.javadoc').
scope(doc_comment, 'storage.type.class.jsdoc').

scope(keyword, 'keyword').
scope(keyword, 'keyword.control').
scope(keyword, 'keyword.operator.new').
scope(keyword, 'keyword.operator.expression').
scope(keyword, 'storage.type').
scope(keyword, 'storage.modifier').

scope(function, 'entity.name.function').
scope(function, 'support.function').
scope(function, 'meta.function-call').
scope(function, 'variable.function').

scope(string, 'string').
scope(string, 'string.quoted').
scope(string, 'string.template').
scope(interpolation, 'string.interpolated').
scope(interpolation, 'punctuation.definition.template-expression').
scope(number, 'constant.numeric').
scope(regex, 'string.regexp').

scope(constant, 'constant').
scope(constant, 'constant.language').
scope(constant, 'variable.other.constant').

scope(variable, 'variable').
scope(variable, 'variable.other').
scope(variable, 'variable.parameter').
scope(special_var, 'variable.language.this').
scope(special_var, 'variable.language.self').

scope(type, 'entity.name.type').
scope(type, 'entity.name.class').
scope(type, 'support.type').
scope(type, 'support.class').
scope(interface, 'entity.name.type.interface').
scope(interface, 'entity.name.type.parameter').

scope(property, 'variable.other.property').
scope(property, 'support.variable.property').

scope(operator, 'keyword.operator').
scope(operator, 'punctuation.accessor').
scope(punctuation, 'punctuation').
scope(punctuation, 'meta.brace').

scope(tag, 'entity.name.tag').
scope(attribute, 'entity.other.attribute-name').

scope(escape, 'constant.character.escape').
scope(invalid, 'invalid').
scope(decorator, 'meta.decorator').
scope(decorator, 'meta.annotation').

semantic(function,      function).
semantic(function,      method).
semantic(function_decl, 'function.declaration').
semantic(function_decl, 'method.declaration').
semantic(constant,      'variable.readonly').
semantic(constant,      'property.readonly').
semantic(constant,      enumMember).
semantic(variable,      variable).
semantic(variable,      parameter).
semantic(type,          type).
semantic(type,          class).
semantic(type,          namespace).
semantic(type,          enum).
semantic(interface,     interface).
semantic(interface,     typeParameter).
semantic(property,      property).

ui(fg, 'editor.foreground',      text).
ui(fg, 'foreground',             text).
ui(fg, 'terminal.foreground',    text).
ui(fg, 'editorCursor.foreground', text).
ui(fg, 'editorLineNumber.foreground', muted).
ui(fg, 'editorLineNumber.activeForeground', subtle).
ui(fg, 'list.activeSelectionForeground', selection).
ui(fg, 'list.inactiveSelectionForeground', selection).
ui(fg, 'list.hoverForeground',   text).
ui(fg, 'statusBar.foreground',   text).
ui(fg, 'button.foreground',      base).

ui(bg, 'editor.background',      base).
ui(bg, 'terminal.background',    base).
ui(bg, 'sideBar.background',     surface).
ui(bg, 'activityBar.background', surface).
ui(bg, 'panel.background',       surface).
ui(bg, 'tab.inactiveBackground', surface).
ui(bg, 'tab.activeBackground',   base).
ui(bg, 'statusBar.background',   raised).
ui(bg, 'titleBar.activeBackground', raised).
ui(bg, 'input.background',       raised).
ui(bg, 'dropdown.background',    raised).
ui(bg, 'list.hoverBackground',   raised).
ui(bg, 'button.background',      match).

ui(fg, 'errorForeground',        error).
ui(fg, 'editorError.foreground', error).
ui(fg, 'terminal.ansiRed',       error).
ui(fg, 'editorWarning.foreground', warning).
ui(fg, 'terminal.ansiYellow',    warning).
ui(fg, 'editorInfo.foreground',  info).
ui(fg, 'terminal.ansiBlue',      info).
ui(fg, 'terminal.ansiCyan',      info).
ui(fg, 'terminal.ansiGreen',     added).
ui(fg, 'terminal.ansiMagenta',   conflict).

ui(fg, 'gitDecoration.untrackedResourceForeground', added).
ui(fg, 'gitDecoration.modifiedResourceForeground', modified).
ui(fg, 'gitDecoration.deletedResourceForeground', deleted).
ui(fg, 'gitDecoration.conflictingResourceForeground', conflict).

ui(fg, 'focusBorder',            focus).
ui(fg, 'list.focusOutline',      focus).
ui(fg, 'list.focusHighlightForeground', focus).
ui(fg, 'editorBracketMatch.border', bracket).

ui(bg, 'editor.selectionBackground', selection).
ui(bg, 'list.activeSelectionBackground', selection).
ui(bg, 'list.inactiveSelectionBackground', selection).
ui(bg, 'editor.wordHighlightBackground', highlight).
ui(bg, 'editor.findMatchBackground', match).
ui(bg, 'editor.findMatchHighlightBackground', match).
ui(bg, 'editorBracketMatch.background', bracket).

% OKLCH resolution
oklch(FgOrBg, Mode, L, C, H) :-
    color(FgOrBg, Hue),
    hue(Hue, H),
    ( lightness(FgOrBg, L0) -> L1 = L0 ; L1 = 80 ),
    ( Hue = neutral -> C = 0.02 ; C = 0.20 ),
    ( Mode = dark -> L = L1 ; L is 100 - L1 ).

ui_color(Mode, Key, oklch(L, C, H, A)) :-
    ui(FgBg, Key, Group),
    Term =.. [FgBg, Group],
    oklch(Term, Mode, L, C, H),
    ( alpha(Term, AlphaName) -> alpha(AlphaName, A) ; A = 1 ).

token_style(Mode, Group, Scopes, oklch(L, C, H, 1), Bold) :-
    color(fg(Group), Hue),
    hue(Hue, _),
    Hue \= neutral,
    oklch(fg(Group), Mode, L, C, H),
    findall(S, scope(Group, S), Scopes),
    Scopes \= [],
    ( bold(Group) -> Bold = true ; Bold = false ).

semantic_color(Mode, Token, oklch(L, C, H, 1), Bold) :-
    semantic(Group, Token),
    color(fg(Group), Hue),
    oklch(fg(Group), Mode, L, C, H),
    ( bold(Group) -> Bold = true ; Bold = false ).

decoration_style(Mode, Token, oklch(L, C, H, A)) :-
    semantic(Group, Token),
    color(bg(Group), _),
    alpha(bg(Group), AlphaName),
    oklch(bg(Group), Mode, L, C, H),
    alpha(AlphaName, A).
