/* jshint -W014, -W116, -W106, -W064, -W097, -W079 */
/* global process, global */
/**
 * @preserve Copyright (c) 2013 Petka Antonov
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
"use strict";
//TODO Prevent passing the same function identity multiple times as a listener
//for the same event

//TODO maxListeners API

var INITIAL_DISTINCT_HANDLER_TYPES = 6;
var domain;
var Array = global.Array;
var isArray = Array.isArray;

function EventEmitter() {
    this.domain = null;
    if( EventEmitter.usingDomains ) {
        domain = domain || require("domain");
        if( domain.active && !(this instanceof domain.Domain) ) {
            this.domain = domain.active;
        }
    }
    this._maybeInit();
}

EventEmitter.EventEmitter = EventEmitter;

EventEmitter.usingDomains = false;

EventEmitter.prototype.emit = function EventEmitter$emit( type, a1, a2 ) {
    if( type === void 0 ) return false;
    if( typeof type !== "string") type = ( "" + type );
    this._maybeInit();

    var index = this._indexOfEvent( type );

    if( index < 0 ) {
        if( type === "error" ) {
            this._emitError( a1 );
        }
        return false;
    }

    var k = index + 1;
    var len = k + this._eventSpace;
    var argc = arguments.length;

    if( this.domain != null && this !== process ) {
        this.domain.enter();
    }

    var eventsWereFired = false;
    if( argc > 3 ) {
        var args = new Array( argc - 1 );
        for( var i = 0, len = args.length; i < len; ++i ) {
            args[i] = arguments[i+1];
        }
        eventsWereFired = this._emitApply( k, len, args );
    }
    else if( len - k === 1 ) {
        switch( argc ) {
        case 1: eventsWereFired = this._emitSingle0( k ); break;
        case 2: eventsWereFired = this._emitSingle1( k, a1 ); break;
        case 3: eventsWereFired = this._emitSingle2( k, a1, a2 ); break;
        }
    }
    else {
        switch( argc ) {
        case 1: eventsWereFired = this._emit0( k, len ); break;
        case 2: eventsWereFired = this._emit1( k, len, a1 ); break;
        case 3: eventsWereFired = this._emit2( k, len, a1, a2 ); break;
        }
    }

    if( this.domain != null && this !== process ) {
        this.domain.exit();
    }
    return eventsWereFired;
};

EventEmitter.prototype.addListener =
EventEmitter.prototype.on =
function EventEmitter$addListener( type, listener ) {
    if( typeof listener !== "function" )
        throw new TypeError("listener must be a function");
    if( typeof type !== "string" )
        type = ( "" + type );

    this._maybeInit();
    this._emitNew( type, listener );
    var index = this._nextFreeIndex( type );
    var events = this._events;
    events[index] = listener;
    return this;
};

EventEmitter.prototype.once = function EventEmitter$once( type, listener ) {
    if( typeof listener !== "function" )
        throw new TypeError("listener must be a function");
    if( typeof type !== "string" )
        type = ( "" + type );

    this._maybeInit();
    this._emitNew( type, listener );
    var index = this._nextFreeIndex( type );
    var events = this._events;
    function s() {
        this.removeListener( type, s );
        return listener.apply( this, arguments );
    }
    events[index] = s;
    s.listener = listener;
    return this;
};

EventEmitter.prototype.listeners = function EventEmitter$listeners( type ) {
    if( typeof type !== "string")
        type = ( "" + type );

    this._maybeInit();
    var index = this._indexOfEvent( type );
    if( index < 0 ) {
        return [];
    }
    var ret = [];
    var k = index + 1;
    var m = k + this._eventSpace;
    var events = this._events;
    for( ; k < m; ++k ) {
        if( events[k] === void 0 ) {
            break;
        }
        ret.push( events[k] );
    }
    return ret;
};

EventEmitter.prototype.removeListener =
function EventEmitter$removeListener( type, listener ) {
    if( typeof listener !== "function" )
        throw new TypeError("listener must be a function");
    if( typeof type !== "string")
        type = ( "" + type );

    this._maybeInit();
    var index = this._indexOfEvent( type );

    if( index < 0 ) {
        return this;
    }
    var events = this._events;
    var eventSpace = this._eventSpace;
    var k = index + 1;
    var j = k;
    var len = k + eventSpace;
    var skips = 0;
    var removeListenerIndex = -2;

    for( ; k < len; ++k ) {
        var item = events[k];
        if( item === listener ||
            ( item !== void 0 && item.listener === listener ) ) {
            skips++;
            events[k] = void 0;
            if( removeListenerIndex === -2 ) {
                removeListenerIndex = this._indexOfEvent("removeListener");
            }
            if( removeListenerIndex >= 0 ) {
                this._emitRemove( type, listener );
            }
        }
        else {
            events[ j++ ] = item;
        }
    }

    for( k = len - skips; k < len; ++k ) {
        events[k] = void 0;
    }


    return this;
};

EventEmitter.prototype.removeAllListeners =
function EventEmitter$removeAllListeners( type ) {
    this._maybeInit();
    if( type === void 0 ) {
        if( this._indexOfEvent("removeListener") >= 0 ) {
            this._emitRemoveAll( void 0 );
        }
        var events = this._events = new Array( this._events.length );
        this._initSpace( events );
        return this;
    }
    if( typeof type !== "string")
        type = ( "" + type );

    var index = this._indexOfEvent( type );
    if( index < 0 ) {
        return this;
    }
    var events = this._events;
    var eventSpace = this._eventSpace;
    var k = index + 1;
    var len = k + eventSpace + 1;
    if( this._indexOfEvent("removeListener") >= 0 ) {
        this._emitRemoveAll( type );
    }
    for( ; k < len; ++k ) {
        events[k] = void 0;
    }

    return this;
};

EventEmitter.listenerCount = function( emitter, type ) {
    if( !( emitter instanceof EventEmitter ) ) {
        throw new TypeError( "Not an event emitter" );
    }

    var total = 0;
    var events = emitter._events;
    if( !isArray( events ) ) {
        return 0;
    }
    var len = events.length;
    if( type === void 0 ) {
        for( var i = 0; i < len; ++i ) {
            if( typeof events[i] === "function" ) total++;
        }
    }
    else {
        if( typeof type !== "string")
            type = ( "" + type );
        var index = this._indexOfEvent( type ) + 1;
        var eventSpace = this._eventSpace;
        var k = index;
        var m = index + eventSpace;
        for( ; k < m; ++k ) {
            if( typeof events[k] === "function" ) total++;
        }
    }
    return total;
};

EventEmitter.prototype._resizeForHandlers =
function EventEmitter$_resizeForHandlers() {
    var events = this._events;
    var tmp = new Array( events.length );
    for( var i = 0, len = tmp.length; i < len; ++i ) {
        tmp[i] = events[i];
    }
    var oldEventSpace = this._eventSpace;
    var newEventSpace = this._eventSpace = ( oldEventSpace * 2 + 2 );
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
            events[i + n] = tmp[k];
            n++;
        }

        k = i + n;
        m = i + newEventSpace;
        for( ; k < m; ++k ) {
            events[k] = void 0;
        }
    }
};



EventEmitter.prototype._doCompact = function EventEmitter$_doCompact() {
    var j = 0;
    var eventSpace = this._eventSpace + 1;
    var eventCount = this._eventCount;
    var shouldCompact = false;
    var events = this._events;
    for( var i = 0; i < eventCount; ++i ) {
        if( events[j+1] === void 0 ) {
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
        var listener = events[ i + 1 ];
        if( listener === void 0 ) {
            skips += eventSpace;
        }
        else {
            var k = i;
            var m = k + eventSpace;
            for( ; k < m; ++k ) {
                events[ j++ ] = events[ k ];
            }
        }
    }
    for( var i = len - skips; i < len; ++i ) {
        events[i] = void 0;
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

    var events = this._events;
    for( var i = oldLength; i < newLength; ++i ) {
        events.push( void 0 );
    }
};

EventEmitter.prototype._emitRemoveAll =
function EventEmitter$_emitRemoveAll( type ) {
    var events = this._events;
    if( type === void 0 ) {
        var len = this._eventLength;
        var eventSpace = this._eventSpace + 1;
        for( var i = 0; i < len; i += eventSpace ) {
            var emitType = events[i];
            var k = i + 1;
            var m = k + eventSpace;
            for( ; k < m; ++k ) {
                var listener = events[k];
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
            var listener = events[k];
            if( listener === void 0 ) {
                break;
            }
            this._emitRemove( type, listener.listener
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
    var events = this._events;
    for( var i = 0; i < eventCount; ++i ) {
        if( events[j] === eventName ) {
            return j;
        }
        j+= eventSpace;
    }
    return -1;
};

EventEmitter.prototype._nextFreeIndex =
function EventEmitter$_nextFreeIndex( eventName ) {
    var eventSpace = this._eventSpace + 1;
    var length = this._eventLength;
    var events = this._events;

    for( var i = 0; i < length; i += eventSpace ) {
        var event = events[i];
        if( event === eventName ) {
            var k = i + 1;
            var len = i + eventSpace;
            for( ; k < len; ++k ) {
                if( events[k] === void 0 ) {
                    return k;
                }
            }
            this._resizeForHandlers();
            return this._nextFreeIndex( eventName );
        }
        else if( event === void 0 ) {
            events[i] = eventName;
            this._eventCount++;
            return i + 1;
        }
        else if( events[ i + 1 ] === void 0) {
            events[i] = eventName;
            return i + 1;
        }
    }
    this._resizeForEvents();
    return this._nextFreeIndex( eventName );
};

EventEmitter.prototype._emitError = function EventEmitter$_emitError( e ) {
    if( this.domain != null ) {
        if( !e ) {
            e = new TypeError("Uncaught, unspecified 'error' event.");
        }
        e.domainEmitter = this;
        e.domain = this.domain;
        e.domainThrown = false;
        this.domain.emit( "error", e );
    }
    else if( e instanceof Error ) {
        throw e;
    }
    else {
        throw new TypeError("Uncaught, unspecified 'error' event.");
    }
};

EventEmitter.prototype._emitApply =
function EventEmitter$_emitApply( index, length, args ) {
    var eventsWereFired = false;
    var multipleListeners = ( length - index ) > 1;
    var events = this._events;
    var event = events[index];
     if( !multipleListeners ) {
        if( event !== void 0) {
            event.apply( this, args );
            return true;
        }
        return false;
    }
    var next = void 0;
    for( ; index < length; ++index ) {
        event = events[index];
        if( event === void 0 ) {
            break;
        }
        eventsWereFired = true;
        if( multipleListeners && ( ( index + 1 ) < length ) ) {
            next = events[ index + 1 ];
        }
        event.apply( this, args );
        //The current listener was removed from its own callback
        if( multipleListeners && ( ( index + 1 ) < length ) &&
            next !== void 0 && next === events[index] ) {
            index--;
            length--;
        }
    }
    return eventsWereFired;
};

EventEmitter.prototype._emitSingle0 =
function EventEmitter$_emitSingle0( index ) {
    var event = this._events[index];
    if( event !== void 0) {
        event.call( this );
        return true;
    }
    return false;
};

EventEmitter.prototype._emitSingle1 =
function EventEmitter$_emitSingle1( index, a1 ) {
    var event = this._events[index];
    if( event !== void 0) {
        event.call( this, a1 );
        return true;
    }
    return false;
};

EventEmitter.prototype._emitSingle2 =
function EventEmitter$_emitSingle2( index, a1, a2 ) {
    var event = this._events[index];
    if( event !== void 0) {
        event.call( this, a1, a2 );
        return true;
    }
    return false;
};

EventEmitter.prototype._emit0 = function EventEmitter$_emit0( index, length ) {
    var eventsWereFired = false;
    var next = void 0;
    var events = this._events;
    var event;
    for( ; index < length; ++index ) {
        event = events[index];
        if( event === void 0 ) {
            break;
        }
        eventsWereFired = true;
        if( ( ( index + 1 ) < length ) ) {
            next = events[ index + 1 ];
        }
        event.call( this );
        //The current listener was removed from its own callback
        if( ( ( index + 1 ) < length ) &&
            next !== void 0 && next === events[index] ) {
            index--;
            length--;
        }
        else if( next === void 0 ) {
            break;
        }
    }
    return eventsWereFired;
};

EventEmitter.prototype._emit1 =
function EventEmitter$_emit1( index, length, a1 ) {
    var eventsWereFired = false;
    var next = void 0;
    var events = this._events;
    var event;
    for( ; index < length; ++index ) {
        event = events[index];
        if( event === void 0 ) {
            break;
        }
        eventsWereFired = true;
        if( ( ( index + 1 ) < length ) ) {
            next = events[ index + 1 ];
        }
        event.call( this, a1 );
        //The current listener was removed from its own callback
        if( ( ( index + 1 ) < length ) &&
            next !== void 0 && next === events[index] ) {
            index--;
            length--;
        }
        else if( next === void 0 ) {
            break;
        }
    }
    return eventsWereFired;
};

EventEmitter.prototype._emit2 =
function EventEmitter$_emit2( index, length, a1, a2 ) {
    var eventsWereFired = false;
    var next = void 0;
    var events = this._events;
    var event;
    for( ; index < length; ++index ) {
        event = events[index];
        if( event === void 0 ) {
            break;
        }
        eventsWereFired = true;
        if( ( ( index + 1 ) < length ) ) {
            next = events[ index + 1 ];
        }
        event.call( this, a1, a2 );
        //The current listener was removed from its own callback
        if( ( ( index + 1 ) < length ) &&
            next !== void 0 && next === events[index] ) {
            index--;
            length--;
        }
        else if( next === void 0 ) {
            break;
        }
    }
    return eventsWereFired;
};

//eventSpace =
//The reserved space for handlers of a distinct event type

//eventCount =
//The amount of unique event types currently registered.
//Might not be the actual amount


EventEmitter.prototype._maybeInit = function EventEmitter$_maybeInit() {
    if( !isArray( this._events ) ) {
        this._eventSpace = 1;
        this._eventCount = 0;
        var events = this._events = new Array( ( ( this._eventSpace + 1 ) *
                                INITIAL_DISTINCT_HANDLER_TYPES ) | 0);
        this._initSpace( events );
    }
};

EventEmitter.prototype._initSpace = function EventEmitter$_initSpace( events ) {
    var len = events.length;
    for( var i = 0; i < len; ++i ) {
        events[i] = void 0;
    }
};

module.exports = EventEmitter;

