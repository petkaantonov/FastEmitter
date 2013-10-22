FastEmitter
===========

Fast event emitter

Benchmarks:

- [Single listener](http://jsperf.com/1234567213/7)
- [Multiple separate listeners](http://jsperf.com/1234567213/8)

##Pitfalls

Fast emitter is relying heavily on the fact that strings are internalized in V8. You shouldn't worry about this because in normal use event types are not dynamically generated but originate from string literals.

However you should be aware that if you do something like dynamically concatenating strings to create event name, you will slow things down.

If you have huge amount of different event types on the same event emitter, then performance will suffer. Again, in practice there are not a huge amount of different event types on the same emitter active at the same time though.
