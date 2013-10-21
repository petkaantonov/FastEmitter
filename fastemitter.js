"use strict";

var INITIAL_DISTINCT_HANDLER_TYPES = 6;
var domain;

function EventEmitter() {
    this.domain = null;
    if( EventEmitter.usingDomains ) {
        domain = domain || require("domain");
        if( domain.active && !(this instanceof domain.Domain) ) {
            this.domain = domain.active;
        }
    }
    //The reserved space for handlers of a distinct event type
    this._eventSpace = 1;
    //The amount of unique event types currently registered.
    //Might not be the actual amount
    this._eventCount = 0;
    //The length of the buffer where everything is stored
    //Initially reserves space for INITIAL_DISTINCT_HANDLER_TYPES
    //distinct event types
    this._eventLength = ( ( this._eventSpace + 1 ) *
                            INITIAL_DISTINCT_HANDLER_TYPES ) | 0;
    this._initSpace();
}

EventEmitter.EventEmitter = EventEmitter;

EventEmitter.usingDomains = false;

EventEmitter.prototype.emit = function EventEmitter$emit( type, a1, a2 ) {
    if( type === void 0 ) return false;
    if( typeof type !== "string") type = ( "" + type );

    var index = this._indexOfEvent( type );

    if( index < 0 ) {
        if( type === "error" ) {
            this._emitError( a1 );
        }
        return false;
    }

    var k = index + 1;
    var len = k + this._eventSpace + 1;
    var argc = arguments.length;

    if( this.domain !== null && this !== process ) {
        this.domain.enter();
    }

    if( argc > 3 ) {
        var args = new Array( argc - 1 );
        for( var i = 0, len = args.length; i < len; ++i ) {
            args[i] = arguments[i+1];
        }
        eventsWereFired = this._emitApply( k, len, args );
    }
    else {
        switch( argc ) {
        case 1: eventsWereFired = this._emit0( k, len ); break;
        case 2: eventsWereFired = this._emit1( k, len, a1 ); break;
        case 3: eventsWereFired = this._emit2( k, len, a1, a2 ); break;
        }
    }

    if( this.domain !== null && this !== process ) {
        this.domain.exit();
    }
    return eventsWereFired;
};



//TODO emit addListener
//TODO check memory leak
EventEmitter.prototype.addListener =
EventEmitter.prototype.on =
function EventEmitter$addListener( type, listener ) {
    if( typeof listener !== "function" )
        throw new TypeError('listener must be a function');
    if( typeof type !== "string" )
        type = ( "" + type );

    this._emitNew( type, listener );
    var index = this._nextFreeIndex( type );
    this[index] = listener;
    return this;
};

EventEmitter.prototype.once = function EventEmitter$once( type, listener ) {
    if( typeof listener !== "function" )
        throw new TypeError('listener must be a function');
    if( typeof type !== "string" )
        type = ( "" + type );

    this._emitNew( type, listener );
    var index = this._nextFreeIndex( type );
    function s() {
        this.removeListener( type, s );
        return listener.apply( this, arguments );
    }
    this[index] = s;
    s.listener = listener;
    return this;
};

EventEmitter.prototype.listeners = function EventEmitter$listeners( type ) {
    if( typeof type !== "string")
        type = ( "" + type );

    var index = this._indexOfEvent( type );
    if( index < 0 ) {
        return [];
    }
    var ret = [];
    var k = index + 1;
    var m = k + this._eventSpace + 1;
    for( ; k < m; ++k ) {
        if( this[k] === void 0 ) {
            break;
        }
        ret.push( this[k] );
    }
    return ret;
};

//TODO emit removeListener
//TODO check memory leak
EventEmitter.prototype.removeListener =
function EventEmitter$removeListener( type, listener ) {
    if( typeof listener !== "function" )
        throw new TypeError('listener must be a function');
    if( typeof type !== "string")
        type = ( "" + type );

    var index = this._indexOfEvent( type );

    if( index < 0 ) {
        return this;
    }
    var eventSpace = this._eventSpace;
    var k = index + 1;
    var j = k;
    var len = k + eventSpace + 1;
    var skips = 0;
    var removeListenerIndex = -2;

    for( ; k < len; ++k ) {
        var item = this[k];
        if( item === listener ||
            ( item !== void 0 && item.listener === listener ) {
            skips++;
            this[k] = void 0;
            if( removeListenerIndex === -2 ) {
                removeListenerIndex = this._indexOfEvent("removeListener");
            }
            if( removeListenerIndex >= 0 ) {
                this._emitRemove( type, listener );
            }
        }
        else {
            this[ j++ ] = item;
        }
    }

    for( k = len - skips; k < len; ++k ) {
        this[k] = void 0;
    }


    return this;
};

EventEmitter.prototype.removeAllListeners =
function EventEmitter$removeAllListeners( type ) {
    if( type === void 0 ) {
        if( this._indexOfEvent("removeListener") >= 0 ) {
            this._emitRemoveAll( void 0 );
        }
        this._initSpace();
        return this;
    }
    if( typeof type !== "string")
        type = ( "" + type );

    var index = this._indexOfEvent( type );
    if( index < 0 ) {
        return this;
    }

    var eventSpace = this._eventSpace;
    var k = index + 1;
    var len = k + eventSpace + 1;
    if( this._indexOfEvent("removeListener") >= 0 ) {
        this._emitRemoveAll( type );
    }
    for( ; k < len; ++k ) {
        this[k] = void 0;
    }

    return this;
};

EventEmitter.listenerCount = function( emitter, type ) {
    if( typeof type !== "string")
        type = ( "" + type );

    var total = 0;
    var len = emitter._eventLength;
    for( var i = 0; i < len; ++i ) {
        if( typeof emitter[i] === "function" ) total++;
    }
    return total;
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
    var length = this._eventLength = ( ( newEventSpace + 1 ) *
            Math.max( this._eventCount, INITIAL_DISTINCT_HANDLER_TYPES ) ) | 0;

    newEventSpace++;
    oldEventSpace++;
    for( var i = 0, j = 0;
        i < length;
        i+= newEventSpace, j += oldEventSpace ) {

        var k = j;
        var m = k + oldEventSpace;
        var n = 0;
        for( ; k < m; ++k ) {
            this[i + n] = tmp[k];
            n++;
        }

        k = i + n;
        m = i + newEventSpace;
        for( ; k < m; ++k ) {
            this[k] = void 0;
        }
    }
};



EventEmitter.prototype._doCompact = function EventEmitter$_doCompact() {
    var j = 0;
    var eventSpace = this._eventSpace + 1;
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
            var k = i;
            var m = k + eventSpace;
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
    var oldLength = this._eventLength;
    var newLength = this._eventLength = ( ( this._eventSpace + 1 ) *
            Math.max( this._eventCount * 2, INITIAL_DISTINCT_HANDLER_TYPES ) );

    for( var i = oldLength; i < newLength; ++i ) {
        this[i] = void 0;
    }
};

EventEmitter.prototype._emitRemoveAll =
function EventEmitter$_emitRemoveAll( type ) {
    if( type === void 0 ) {
        var len = this._eventLength;
        var eventSpace = this._eventSpace + 1;
        for( var i = 0; i < len; i += eventSpace ) {
            var emitType = this[i];
            var k = i + 1;
            var m = k + eventSpace;
            for( ; k < m; ++k ) {
                var listener = this[k];
                if( listener === void 0 ) {
                    break;
                }
                this._emitRemove( emitType, listener.listener
                                    ? listener.listener
                                    : listener );
            }

        }
    }
    else {
        var k = this._indexOfEvent( type ) + 1;
        var m = k + this._eventSpace + 1;

        for( ; k < m; ++k ) {
            var listener = this[k];
            if( listener === void 0 ) {
                break;
            }
            this._emitRemove( emitType, listener.listener
                    ? listener.listener
                    : listener );
        }
    }
};

EventEmitter.prototype._emitRemove =
function EventEmitter$_emitRemove( type, fn ) {
    this.emit( "removeListener", type, fn );
};

EventEmitter.prototype._emitNew = function EventEmitter$_emitNew( type, fn ) {
    var i = this._indexOfEvent( "newListener ");
    if( i < 0 ) return;
    this.emit( "newListener", type, fn );
};

EventEmitter.prototype._indexOfEvent =
function EventEmitter$_indexOfEvent( eventName ) {
    var j = 0;
    var eventSpace = this._eventSpace + 1;
    var eventCount = this._eventCount;
    for( var i = 0; i < eventCount; ++i ) {
        if( this[j] === eventName ) {
            return j;
        }
        j+= eventSpace;
    }
    return -1;
};

EventEmitter.prototype._nextFreeIndex =
function EventEmitter$_nextFreeIndex( eventName ) {
    var eventSpace = this._eventSpace + 1;
    var eventCount = this._eventCount;
    var length = this._eventLength;

    for( var i = 0; i < length; i += eventSpace ) {
        if( this[i] === eventName ) {
            var k = i + 1;
            var len = i + eventSpace;
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

EventEmitter.prototype._emitError = function EventEmitter$_emitError( e ) {
    if( this.domain != null ) {
        if( !e ) e = new TypeError('Uncaught, unspecified "error" event.');
        e.domainEmitter = this;
        e.domain = this.domain;
        e.domainThrown = false;
        this.domain.emit( "error", e );
    }
    else if( e instanceof Error ) {
        throw e;
    }
    else {
        throw new TypeError('Uncaught, unspecified "error" event.');
    }
};

EventEmitter.prototype._emitApply =
function EventEmitter$_emitApply( index, length, args ) {
    var eventsWereFired = false;
    for( ; index < length; ++index ) {
        if( this[index] === void 0 ) {
            break;
        }
        eventsWereFired = true;
        this[index].apply( this, args );
    }
    return eventsWereFired;
};

EventEmitter.prototype._emit0 = function EventEmitter$_emit0( index, length ) {
    var eventsWereFired = false;
    for( ; index < length; ++index ) {
        if( this[index] === void 0 ) {
            break;
        }
        eventsWereFired = true;
        this[index]();
    }
    return eventsWereFired;
};

EventEmitter.prototype._emit1 =
function EventEmitter$_emit1( index, length, a1 ) {
    var eventsWereFired = false;
    for( ; index < length; ++index ) {
        if( this[index] === void 0 ) {
            break;
        }
        eventsWereFired = true;
        this[index]( a1 );
    }
    return eventsWereFired;
};

EventEmitter.prototype._emit2 =
function EventEmitter$_emit2( index, length, a1, a2 ) {
    var eventsWereFired = false;
    for( ; index < length; ++index ) {
        if( this[index] === void 0 ) {
            break;
        }
        eventsWereFired = true;
        this[index]( a1, a2 );
    }
    return eventsWereFired;
};

EventEmitter.prototype._initSpace = function EventEmitter$_initSpace() {
    var len = this._eventLength;
    for( var i = 0; i < len; ++i ) {
        this[i] = void 0;
    }
};
