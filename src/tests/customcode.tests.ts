import * as assert from 'assert';
import {CustomCode} from '../remotes/zsimulator/customcode';



suite('CustomCode', () => {
	const jsCode=`
// Sample code
class PortOut {
	constructor(name, port) {
		this.name=name;
		this.port=port;
		this.value=0xFF;
	}

	// Called when an 'out' is executed in Z80.
	out(port, value) {
		if(port == this.port) {
			// Store value internally
			this.value=value;
			// Send message to UI
			ApiSendMessage({
				command: 'my_'+this.name,
				value: value
			});
		}
	}
};

class PortIn {
	constructor(name, port) {
		this.name=name;
		this.port=port;
		this.value=0xFF;	// Default
	}

	// Sets the value that will be returned.
	setValue(value) {
		this.value = value;
	}

	// Called when an 'out' is executed in Z80.
	in(port) {
		if(port != this.port)
			return undefined;
		// Return value
		return this.value;
	}
};

// Instantiate 2 out ports.
this.outPortA = new PortOut('PortA', 0x8000);
this.outPortB = new PortOut('PortB', 0x8001);

// Instantiate 2 in ports.
this.inPortA = new PortIn('PortA', 0x9000);
this.inPortA.setValue(90);
this.inPortB = new PortIn('PortB', 0x9001);
this.inPortB.setValue(91);


/**
 * This function is called when an 'out' is executed in Z80.
 */
this.portSet = (port, value) => {
	// Go through all ports
	this.outPortA.out(port, value);
	this.outPortB.out(port, value);
}

/**
 * This function is called when an 'in' is executed in Z80.
 */
this.portGet = (port) => {
	// Check all ports and return a valid value
	let value = this.inPortA.in(port);
	if(value != undefined)
		return value;
	value = this.inPortB.in(port);
	return value;
}

/**
 * This function is called by if new input
 * data is available.
 */
this.receivedMessage = (msg) => {
	// Check if joy data
	switch(msg.command) {
		case 'joy0':
			this.inPortA.setValue(msg.data);
		break;
		case 'joy1':
			this.inPortB.setValue(msg.data);
		break;
	}
}
`;


	test('out value', () => {
		const custom=new CustomCode(jsCode);
		// @ts-ignore: protected access
		const context=custom.context;
		assert.notEqual(undefined, context.outPortA);
		assert.notEqual(undefined, context.outPortB);

		//custom.writePort(0x7000, 0xAA);
		//assert.equal(defaultValue, context.outPortA.value);

		custom.writePort(0x8000, 0x55);
		assert.equal(0x55, context.outPortA.value);

		custom.writePort(0x8001, 0xA5);
		assert.equal(0xA5, context.outPortB.value);
		assert.equal(0x55, context.outPortA.value);
	});


	test('sendMessage', () => {
		const custom=new CustomCode(jsCode);
		let sendMessageCalled=false;
		custom.on('sendMessage', msg => {
			sendMessageCalled=true;
		});

		assert.equal(false, sendMessageCalled);
		custom.writePort(0x8000, 0x55);
		assert.equal(true, sendMessageCalled);
	});


	test('in/receiveMessage', () => {
		const custom=new CustomCode(jsCode);
		// @ts-ignore: protected access
		const context=custom.context;

		let result=custom.readPort(0x7000);
		assert.equal(undefined, result);

		result=custom.readPort(0x9000);
		assert.equal(90, result);

		result=custom.readPort(0x9001);
		assert.equal(0, result);

		// Receive
		const msg={
			command: 'joy0',
			data: 110
		};
		custom.receivedMessage(msg);
		result=custom.readPort(0x9000);
		assert.equal(110, result);
	});


	test('tick', () => {
		const custom=new CustomCode(jsCode);
		// @ts-ignore: protected access
		const context=custom.context;

		let result=custom.readPort(0x9000);
		assert.equal(90, result);
		result=custom.readPort(0x9001);
		assert.equal(0, result);

		custom.tick(12);	// Writes the t-states to the port for testing.
		result=custom.readPort(0x9000);
		assert.equal(24, result);	// 2 * t-states
		result=custom.readPort(0x9001);
		assert.equal(12, result);	// t-states

		custom.tick(24);	// Writes the t-states to the port for testing.
		result=custom.readPort(0x9000);
		assert.equal(48, result);	// 2 * t-states
		result=custom.readPort(0x9001);
		assert.equal(24, result);	// t-states
	});

});

