// What switches the switch: the chain from the controller's clock to the
// power switch's gate, and the control loop that closes it. Pure data, no
// DOM; drawn by control-ui.js. Numbers are for a SiC MOSFET switching at
// 100 kHz in an 800 V converter, as in the car charger.
//
// `glyph` is a small sketch of the stage's signal (SVG path data in a 64 × 24
// box, drawn with the text color); `dashed` is a second, dashed trace.

export const CHAIN = [
  {
    id: 'clock',
    name: 'Clock',
    part: 'A quartz crystal',
    signal: '≈ 100 MHz ticks',
    glyph: 'M2 18H6V6H10V18H14V6H18V18H22V6H26V18H30V6H34V18H38V6H42V18H46V6H50V18H54V6H58V18H62',
    role: `A sliver of quartz vibrates like a tiny tuning fork, and an amplifier keeps it ringing at its own frequency, often 8 to 25 MHz. The microcontroller multiplies that into its working clock, here 100 MHz.`,
    why: `Nothing has to switch it on. The circuit is built to be unstable: at power-up, electrical noise is enough to start the vibration, and it grows until it settles. So the chain of switches ends here, not in yet another switch but in something that runs by itself, like a pendulum clock.`,
    measure: `Its frequency is accurate to tens of parts per million, and so is every pulse width. Controllers check that it keeps running, and fall back to a slower internal clock if it stops.`,
  },
  {
    id: 'pwm',
    name: 'PWM unit',
    part: 'A timer in the microcontroller that sets how wide each pulse is',
    signal: 'Pulse-width modulation: 3.3 V pulses',
    glyph: 'M2 18H5V6H9V18H17V6H24V18H30V6H40V18H44V6H56V18H62',
    role: `PWM stands for pulse-width modulation: pulses at a fixed rate, each as wide as the control software wants. The PWM unit is a timer inside the microcontroller that makes them by itself, so the software only has to update one number. A counter counts the clock ticks up to 1000 and starts over; the output is high (3.3 V, a few milliamperes) while the count is below that number, the compare value (the chart <a href="#switching">Behind the pulses</a>). The unit also adds a dead time between one switch of a half-bridge turning off and the other turning on, so the two are never on together.`,
    why: `Counting is exact, but it sets a limit. A 100 MHz clock and 100 kHz switching leave 1000 counts per period, so the duty cycle moves in steps of 0.1 %. Switching ten times faster makes the steps ten times coarser, unless the timer runs faster too.`,
    measure: `The controller knows every duty cycle and current it commanded. Logged over months, that is the cheapest record there is of how hard a converter worked: its mission profile.`,
  },
  {
    id: 'driver',
    name: 'Gate driver',
    part: 'An amplifier across an isolation barrier',
    signal: '+18 / −4 V, peaks of a few amperes',
    glyph: 'M2 20H8V3H18V20H26V3H34V20H42V3H54V20H62',
    role: `Turns each logic pulse into the gate voltage and current the switch needs. Its output stage is two small MOSFETs, one to each supply rail: transistors switching a transistor, but small, fast ones.`,
    why: `A microcontroller pin can give at most about 20 mA; even then, charging a 100 nC gate takes 5 µs, half of a 10 µs switching period. A driver gives about 5 A: 20 ns in theory, a few tens of nanoseconds with the gate resistor that tames the edges. And in a half-bridge the upper switch's source jumps between 0 and 800 V at every edge, so the driver's output side has to float with it: it has its own isolated supply, and the signal crosses a barrier (a tiny transformer, a capacitor or light).`,
    measure: `It guards the switch. If the voltage across a switch that should be on rises (desaturation, as in a short circuit), the driver turns it off within a few microseconds. Many drivers also report faults and their own temperature, and research drivers measure the gate voltage and the switching times, which are monitoring signals in their own right.`,
  },
  {
    id: 'gate',
    name: 'Gate',
    part: 'A capacitor on the switch',
    signal: '≈ 100 nC to charge',
    glyph: 'M2 20C8 20 10 12 18 12H36C42 12 46 5 62 4',
    role: `The gate sits on a thin insulator, so to the driver it is a capacitor. Charged above the threshold voltage (a few volts), it opens a channel and the switch conducts; drained, the switch blocks. Holding it on takes almost no current.`,
    why: `Switching costs only the gate charge, once each way per cycle: about Q × ΔV × f = 100 nC × 22 V × 100 kHz ≈ 0.2 W, to control about 10 kW. While the switch's own voltage swings, the gate voltage pauses on a flat step, the Miller plateau, as the charge goes into the capacitance between gate and drain.`,
    measure: `In SiC MOSFETs the threshold voltage drifts as charge gets trapped in the gate oxide, a sign of gate wear. The Miller plateau and the turn-on delay change with temperature, so they can tell the junction temperature without a sensor.`,
  },
  {
    id: 'switch',
    name: 'Power switch',
    part: 'The SiC MOSFET, GaN HEMT or IGBT this page takes apart',
    signal: 'Tens of amperes at hundreds of volts',
    glyph: 'M2 4H22L30 20H62',
    dashed: 'M2 20H20L26 4H62',
    role: `Connects the load current or blocks the voltage, as its gate says. Everything before it handles milliwatts to a few watts; the switch handles kilowatts. The sketch shows a turn-on: the current rises (dashed) and the voltage across the switch falls.`,
    why: `Each edge costs a little energy, the switching loss, because for tens of nanoseconds (more in an IGBT) the switch carries current and voltage at once. Faster edges cost less, which is why SiC and GaN can switch faster, and so get by with smaller inductors, capacitors and transformers.`,
    measure: `Its on-state voltage at a known current rises as the package wears; <a href="#igbt/package/heat">Age it</a> in the package view shows why.`,
  },
];

// The loop back from what the converter makes to the compare value.
export const LOOP = {
  id: 'loop',
  name: 'Control loop',
  part: 'Sensors and software',
  signal: 'Measured currents and voltages, every period',
  role: `Sensors measure the output voltage and the currents, and the software compares them with what they should be and updates the compare value, every switching period or every few. In a motor drive it runs a model of the motor; in the car charger's active rectifier it makes the current follow the grid voltage.`,
  whyLabel: 'Starting up',
  why: `Before the converter runs, nothing powers the controller. A phone charger starts itself: a resistor, or a high-voltage start-up pin, trickle-charges its controller's supply capacitor from the mains. At a set voltage the controller wakes up and begins switching, and then a spare winding on the transformer takes over its supply. In a car charger, the car's 12 V battery, or a small supply of that same kind, powers the microcontroller before the main stages start.`,
  measure: `The sensors that serve the control loop serve condition monitoring too: currents, voltages and temperatures are already measured, many times a second, and only need to be kept.`,
};

export const STAGES = [...CHAIN, LOOP];
