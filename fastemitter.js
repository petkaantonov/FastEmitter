"use strict";

function EventEmitter() {
    this.domain = null;
    this._eventSpace = 4;
    this._eventCount = 0;
    this._eventLength = ( ( this._eventSpace + 1 ) * 6 ) | 0;
    this._initSpace();
}

EventEmitter.prototype.emit = function EventEmitter$emit( type ) {
    if( type === void 0 ) return false;
    if( typeof type !== "string ")
        type = ( "" + type );

    //TODO "error" event stuff

    var index = this._indexOfEvent( type );

    if( index < 0 ) {
        return false;
    }

    var eventSpace = this._eventSpace;
    var k = index + 1;
    var len = k + eventSpace + 1;
    var eventsWereFired = false;

    if( arguments.length > 4 ) {
        var args = new Array( arguments.length - 1 );
        for( var i = 0, len = args.length; i < len; ++i ) {
            args[i] = arguments[i+1];
        }
    }

    switch( arguments.length ) {
    case 1:
        for( ; k < len; ++k ) {
            if( this[k] === void 0 ) {
                break;
            }
            eventsWereFired = true;
            this[k]();
        }
        break;
    case 2:
        for( ; k < len; ++k ) {
            if( this[k] === void 0 ) {
                break;
            }
            eventsWereFired = true;
            this[k]( arguments[1] );
        }

        break;
    case 3:
        for( ; k < len; ++k ) {
            if( this[k] === void 0 ) {
                break;
            }
            eventsWereFired = true;
            this[k]( arguments[1], arguments[2] );
        }
        break;
    default:
        for( ; k < len; ++k ) {
            if( this[k] === void 0 ) {
                break;
            }
            eventsWereFired = true;
            this[k].apply( this, args );
        }
        break;
    }
    return eventsWereFired;
};

//TODO emit addListener
//TODO check memory leak
EventEmitter.prototype.addListener =
function EventEmitter$addListener( type, listener ) {
    if( typeof listener !== "function" )
        throw new TypeError('listener must be a function');
    if( typeof type !== "string ")
        type = ( "" + type );

    var index = this._nextFreeIndex( type );
    this[index] = listener;
    return this;
};

//TODO emit removeListener
//TODO check memory leak
EventEmitter.prototype.removeListener =
function EventEmitter$removeListener( type, listener ) {
    if( typeof listener !== "function" )
        throw new TypeError('listener must be a function');
    if( typeof type !== "string ")
        type = ( "" + type );

    var index = this._indexOfEvent( type );

    if( index < 0 ) {
        return this;
    }
    var eventSpace = this._eventSpace;
    var k = index + 1;
    var j = k;
    var len = k + eventSpace + 1;

    for( ; k < len; ++k ) {
        if( this[k] === listener ) {
            this[k] = void 0;
        }
        else {
            this[ j++ ] = this[ k ];
        }
    }

    return this;
};

EventEmitter.prototype.removeAllListeners =
function EventEmitter$removeAllListeners( type ) {
    if( type === void 0 ) {
        this._initSpace();
        return this;
    }
    if( typeof type !== "string ")
        type = ( "" + type );

    var index = this._indexOfEvent( type );
    if( index < 0 ) {
        return this;
    }

    var eventSpace = this._eventSpace;
    var k = index + 1;
    var len = k + eventSpace + 1;

    for( ; k < len; ++k ) {
        this[k] = void 0;
    }

    return this;
};

EventEmitter.prototype._resizeForHandlers =
function EventEmitter$_resizeForHandlers() {
    var tmp = new Array( this._eventLength );
    for( var i = 0, len = tmp.length; i < len; ++i ) {
        tmp[i] = this[i];
    }
    var oldEventSpace = this._eventSpace;
    var newEventSpace = this._eventSpace = ( oldEventSpace * 2 + 2 );
    var eventCount = this._eventCount;
    var length = this._eventLength = ( ( this._eventSpace + 1 ) *
            Math.max( this._eventCount, 6 ) ) | 0;

    var oldI = 0;
    var len = Math.max( eventCount, 6 );
    for( var i = 0; i < len; ++i ) {
        var j;
        for( j = oldI; j < oldEventSpace; ++j ) {
            this[j] = tmp[j];
        }
        for( ; j < newEventSpace; ++j ) {
            this[j] = void 0;
        }
        oldI += oldEventSpace
    }
};



EventEmitter.prototype._doCompact = function EventEmitter$_doCompact() {
    var j = 0;
    var eventSpace = this._eventSpace;
    var eventCount = this._eventCount;
    var shouldCompact = false;
    for( var i = 0; i < eventCount; ++i ) {
        if( this[j+1] === void 0 ) {
            shouldCompact = true;
            break;
        }
        j += eventSpace;
    }
    if( !shouldCompact ) return false;

    j = 0;
    var len = this._eventLength;
    var skips = 0;
    for( var i = 0; i < len; i += eventSpace ) {
        var listener = this[ i + 1 ];
        if( listener === void 0 ) {
            skips += eventSpace;
        }
        else {
            var k = i - 1;
            var m = k + eventSpace + 1;
            for( ; k < m; ++k ) {
                this[ j++ ] = this[ k ];
            }
        }
    }
    for( var i = len - skips; i < len; ++i ) {
        this[i] = void 0;
    }
    return true;
};

EventEmitter.prototype._resizeForEvents =
function EventEmitter$_resizeForEvents() {
    if( this._doCompact() ) {
        return;
    }
    var oldLength = this._oldLength;
    var newLength = this._eventLength = ( ( this._eventSpace + 1 ) *
            Math.max( this._eventCount * 2, 6 ) ) | 0;

    for( var i = oldLength; i < newLength; ++i ) {
        this[i] = void 0;
    }

};

EventEmitter.prototype._indexOfEvent =
function EventEmitter$_indexOfEvent( eventName ) {
    if( this._eventCount === 0 ) return -1;
    var j = 0;
    var eventSpace = this._eventSpace;
    var eventCount = this._eventCount;
    for( var i = 0; i < eventCount; ++i ) {
        if( this[j] === eventName ) {
            return j;
        }
        j+= eventSpace;
    }
};

EventEmitter.prototype._nextFreeIndex =
function EventEmitter$_nextFreeIndex( eventName ) {
    var eventSpace = this._eventSpace;
    var eventCount = this._eventCount;
    var length = this._eventLength;
    //eventcount is not good length
    for( var i = 0; i < length; i += eventSpace ) {
        if( this[i] === eventName ) {
            var k = i + 1;
            var len = i + eventSpace + 1;
            for( ; k < len; ++k ) {
                if( this[k] === void 0 ) {
                    return k;
                }
            }
            this._resizeForHandlers();
            //Todo no-recursion
            return this._nextFreeIndex( eventName );
        }
        else if( this[i] === void 0 ) {
            this[i] = eventName;
            this._eventCount++;
            return i+1;
        }
    }
    this._resizeForEvents();
    return this._nextFreeIndex( eventName );
};

EventEmitter.prototype._initSpace = function EventEmitter$_initSpace() {
    var len = this._eventLength;
    for( var i = 0; i < len; ++i ) {
        this[i] = void 0;
    }
};
