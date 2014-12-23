'use strict';

require('colors');
var fs = require('fs'),
    diff = require( 'diff' );

var walk = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      var fullPath = dir + '/' + file;
      fs.stat(fullPath, function(err, stat) {
        if (stat && stat.isDirectory()) {
          results.push( { dir: dir, filename: "" } );
          walk(fullPath, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push( { dir: dir, filename: file } );
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

var i = 0;

function OScriptObj( parent ) { 
    this.children = [];
    this.parent = parent;
    this.features = {};
}

function countLines( str ) { 
    return str.split(/\r\n|[\n\r\u0085\u2028\u2029]/g).length;
}

function diffFiles( f1, f2, diffFunc ) { 
    var f1Content = fs.readFileSync( f1, { encoding: 'utf8' } );
    var f2Content = fs.readFileSync( f2, { encoding: 'utf8' } );
        
    if ( f1Content && f2Content ) { 
        return { 
            diffs: diff[ diffFunc || 'diffChars' ]( f1Content, f2Content ),
            leftLines: countLines( f1Content ),
            rightLines: countLines( f2Content ) 
        };
    }
    return 0;
}

var startPath = "c:/opentext/sharedsc/replicator/ospace_src";

walk( startPath, function( err, results ) { 
    var all_objects = {};
    var processed = [];
    
    results.forEach( function( file ) { 
        var objName = file.dir.replace( startPath, "" );
        objName = objName.substring( 1 );
        if( objName.length ) { 
            processed.push( { dir: objName, filename: file.filename } );
        }
    } );
    
    processed.forEach( function(file) { 
        var obj = all_objects[file.dir];
        if( !obj ) { 
            var parentPath = file.dir.split( '/' ).slice( 0, -1 ).join( '/' );
            obj = all_objects[file.dir] = {
                name: file.dir,
                scripts: [],
                overridden: [],
                interesting: [],
                parent: all_objects[parentPath]
            };
        }

        if( /^.+\.Script$/.test( file.filename ) ) { 
            obj.scripts.push( file.filename );
        }
    } );
    
    Object.keys( all_objects ).forEach( function( key ) {
        var o = all_objects[key];
        
        if( o.parent ) { 
            o.scripts.forEach( function( s ) { 
                // check the parent chain for the same script name.
                var p = o.parent;
                
                while( p ) { 
                    if( p.scripts.indexOf( s ) >= 0 ) { 

                        o.overridden.push( { name: s, super: p } );
                        
                        var pScript = startPath + "/" + ( p.name ? p.name + "/" : "" ) + s;
                        var cScript =  startPath + "/" + ( o.name ? o.name + "/" : "" ) + s;
                        
                        var result = diffFiles( pScript, cScript, 'diffLines' );

                        if( result.leftLines > 10 && result.diffs.length < 10  ) { 
                            var interest = { parentScript: pScript, childScript: cScript };
                            o.interesting.push( interest ); 
                            
                            console.log( "diffs:", result.diffs.length, ", left:", result.leftLines, ", right:", result.rightLines );
                            console.log( 'diff "' + interest.parentScript + '" "' + interest.childScript + '"'  );
                        }

                        break;
                    }
                    p = p.parent;
                }
            } );
        }
        // console.log( o.name, ", parent:", ( o.parent || {} ).name, ", scripts: ", o.scripts.length, ", overrides: ", o.overridden.length );
    } );

    console.log()    
} );
