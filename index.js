var tmp = require('tmp');
var fs = require('fs');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var util = require('util');
var tesseract = require('node-tesseract');
var gm = require('gm').subClass({imageMagick: true});

var fields_to_extract = {
    "doc_type": {
    	"regexes" : [
    		/(?:STATEMENT|REPORT|RECEIPT|CSV|CHECK|INVOICE|PAYMENT)/i
    	],
    	"default": "unknown"
    },
    "date": {
    	"regexes" : [
        	/(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{1,2},?\s+\d\d\d\d\s+-?\s+[\d:]+\s+(?:AM|PM)?/ig,
            /\d\d\/\d\d\/\d\d/ig
		],
		"default": "unable to find date"        	
   	},
    "currency": {
    	"regexes" : [
    		/CAD/i,
    		/USD/i
    	],
    	"default": "CAD"
    },
    "amount": {
    	"regexes" : [
    		/\$\d+\.\d\d/ig
    	],
    	"default": "unable to find amount"
    }
}

if (process.argv.length !== 3) {
    return error("Usage: " + process.argv[0] + " " + process.argv[1] + " filename");
} else {
    return main();
}

function error(err){
	console.error(err);
	process.exit();
}

function main() {
    var filename = process.argv[2];

    get_filetype(filename, function(err, filetype){
    	if (filetype === "pdf"){    	
    		pdf_to_text(filename, function(err, extractedfilename, text) {
    			if (err) return error(err);
    		    //console.log(extractedfilename);
    		    //exec("open " + extractedfilename, function(){});
                return do_analysis(text);
    		})
    	} else {
    		img_to_text(filename, function(err, extractedfilename, text){
    			if (err) return error(err);
    			return do_analysis(text);
    		})
    	}
    });

    function do_analysis(text){        
        result = analyze_text(text);
        console.log(util.inspect(result));
    }
    
}

function get_filetype(filename, cb){
    //TODO: detect if pdf is actually just an image
	exec("file " + filename, function(err, data){
		if (err){
			console.error(err);	
			cb(err);
		} else {
			if (/pdf/i.test(data)){
				cb(null, "pdf")
			} else {
				cb(null, "image");
			}
		}		
	})
}

function pdf_to_text(file, cb) {

    tmp.file({
        postfix: '.pdf'
    }, function(err, path, fd) {
        if (err) {
        	return cb(err);
        }
        var outfile = path;
        var pdftotext = spawn('pdftotext', [file, "-"]);

        var extracted_text = "";
        pdftotext.stdout.on('data', function(data) {
            //console.log("stdout: " + data);
            extracted_text += data;
        });

        pdftotext.stderr.on('data', function(err) {
            console.log('stderr: ' + err);
        })

        pdftotext.on('close', function(code) {
            fs.writeFileSync(outfile, extracted_text);
            //console.log("Saved to " + outfile);
            return cb(null, outfile, extracted_text);
        })
    });
}

function delete_file(file, cb){
    fs.unlink(file, cb);
}

function img_to_text(file, cb){
    var tempfile = "temp" + Math.random() + ".jpeg";
	gm(file)
    .monochrome()
    .autoOrient()
    .density(600)
    .write(tempfile, function(err){
        if (err){
            delete_file(tempfile, function(){
                return cb(err);      
            })
        } 
        // console.log("Saved to " + tempfile);
        // exec("open " + tempfile, function(){});
        // exec("open " + file, function(){})

        tesseract.process(tempfile, function(err, text){
            if (err){
                return cb(err);
            }
            fs.writeFileSync(tempfile + ".txt", text);
            return cb(err, tempfile, text);
        })
    })
}

function analyze_text(text) {
    //1. Determine format
    var type = get_format(text);

    //2. Based on format, extract fields
    var extracted_data = {};
    Object.keys(fields_to_extract).forEach(function(field) {

        //use regexes or some sort of signature of field to extract from text
        var value = get_value(text, field, fields_to_extract[field].regexes);

        if (value && value.length){
        	extracted_data[field] = value;	
        } else {
        	extracted_data[field] = fields_to_extract[field]["default"];
        }
        
    });
    return extracted_data;
}

function get_format(text) {
    if ((text.indexOf("From:") !== -1) && (text.indexOf("Subject") !== -1)) {
        return "email";
    }
    return "unknown";
}

function get_value(text, field, regexes) {
    var result = [];
    var regex, value;
    for (var i = 0; num_regexes = regexes.length, i < num_regexes; i++) {
        regex = new RegExp(regexes[i]);
        values = text.match(regex);        
        if (values){
    	    result = result.concat(values);
        }
    }
    return result;
}