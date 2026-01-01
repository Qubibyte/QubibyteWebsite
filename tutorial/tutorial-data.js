
// Initialize the global array
var tutorialData = [
    {
        title: "0. Classical Foundations",
        subsections: [
            {
                title: "0.1 Bits and Binary Logic",
                content: `
                <h3>The Fundamental Unit of Information</h3>
                <p>Before we can truly appreciate the revolutionary nature of quantum computing, we must first ground ourselves in the world of classical computing—the paradigm that powers your smartphone, laptop, and the server hosting this tutorial. At the absolute bedrock of all classical information theory lies the <strong>bit</strong> (short for Binary Digit). A bit is the atom of information; it is the answer to the simplest possible question: "Yes or No?", "True or False?", "On or Off?". Mathematically, we represent these two states as <strong>0</strong> and <strong>1</strong>.</p>
                <p>Why binary? The choice of binary is not arbitrary. It is physically robust. In digital electronics, '0' might represent a low voltage (e.g., 0V) and '1' a high voltage (e.g., 5V). By having two distinct, widely separated states, electronic circuits can tolerate a significant amount of noise. A signal of 4.8V is clearly still a '1', and 0.2V is clearly a '0'. This <strong>noise margin</strong> is what allows classical computers to operate with essentially zero errors over billions of operations per second.</p>
                <h3>The Power of Exponential Scaling</h3>
                <p>While a single bit is limited, describing only two possibilities, the power of binary logic emerges when we combine bits. A sequence of two bits can exist in $2^2 = 4$ states: 00, 01, 10, 11. Three bits give us $2^3 = 8$ states. In general, a sequence of <em>n</em> bits can represent $2^n$ distinct states. This exponential scaling is what allows us to represent complex data like high-definition video, 3D games, and vast databases using nothing but long strings of zeros and ones. For example, a single byte (8 bits) can represent any number from 0 to 255. A standard 64-bit integer can represent values up to $18,446,744,073,709,551,615$.</p>
                <p>However, there is a crucial limitation in classical physics that we will challenge later: even though an <em>n</em>-bit register <em>can</em> be in any one of $2^n$ states, at any single moment in time, it is in <strong>exactly one</strong> of those states. It holds one specific number. As we will see, quantum particles are not bound by this restriction, leading to a profound divergence in computational capability.</p>
                `,
                quiz: [{ question: "How many distinct states can be represented by 3 bits?", options: ["3", "6", "8", "9"], correct: 2, explanation: "2 to the power of 3 is 8 (000, 001, 010, 011, 100, 101, 110, 111)." }]
            },
            {
                title: "0.2 Logic Gates & Universal Sets",
                content: `
                <h3>Building Blocks of Computation</h3>
                <p>If bits are the atoms of information, <strong>logic gates</strong> are the chemical bonds that allow us to manipulate them. A logic gate is a physical device implementing a Boolean function; it performs a logical operation on one or more binary inputs and produces a single binary output. The most common gates are familiar to anyone with a background in electronics or programming:</p>
                <ul>
                    <li><strong>AND</strong>: Outputs 1 only if <em>both</em> inputs are 1.</li>
                    <li><strong>OR</strong>: Outputs 1 if <em>at least one</em> input is 1.</li>
                    <li><strong>NOT</strong> (Inverter): Flips a 0 to a 1, and vice versa.</li>
                    <li><strong>XOR</strong> (Exclusive-OR): Outputs 1 if the inputs are <em>different</em>.</li>
                </ul>
                <h3>The Concept of Universality</h3>
                <p>A fascinating result in computer science is the concept of a <strong>Universal Gate Set</strong>. This is a finite set of gates that can be combined to compute <em>any</em> calculable Boolean function. If you have a universal set, you can build a computer of arbitrary power. In classical logic, the <strong>NAND</strong> gate (NOT-AND) is universal all by itself. This means that every single processor, from the one in your washing machine to the supercomputers at NASA, could theoretically be built using nothing but billions of NAND gates wired together in clever ways.</p>
                <p>This concept of universality is critical because it gives us a target for quantum computing. For a quantum computer to be useful, it doesn't need to implement every possible unitary operation natively; it just needs a finite, physically realizable set of "quantum logic gates" that are universal. We will discover later that a set involving the Hadamard, Phase, CNOT, and T gates forms such a set for quantum computing.</p>
                `,
                quiz: [{ question: "Which single gate is universal for classical logic?", options: ["AND", "OR", "NAND", "XOR"], correct: 2, explanation: "The NAND gate can be used to construct AND, OR, and NOT gates, making it universal." }]
            },
            {
                title: "0.3 Reversible Computing",
                content: `
                <h3>The Arrow of Computing Time</h3>
                <p>Take a look at a standard AND gate. If I tell you the output is 0, can you tell me what the inputs were? No. The inputs could have been (0,0), (0,1), or (1,0). Information has been lost. The operation is <strong>irreversible</strong>. In standard classical computing, we constantly discard bits of information. Every time a register is overwritten or a logic gate compresses two bits into one, information assumes a physical form and then vanishes.</p>
                <p>However, the laws of physics at the microscopic level—specifically Quantum Mechanics—are reversible. The Schrödinger equation, which governs the evolution of quantum systems, describes unitary transformations. If you apply a unitary matrix $U$, you can always apply its inverse $U^\\dagger$ to get back to exactly where you started. <strong>Information is never destroyed in a closed quantum system.</strong></p>
                <h3>The Toffoli Gate</h3>
                <p>Because quantum physics is reversible, quantum computers must use <strong>reversible logic gates</strong>. We cannot use the standard AND or OR gates directly. We need gates where the number of inputs equals the number of outputs, and the mapping is a unique one-to-one permutation. In classical reversible computing, the most famous universal gate is the <strong>Toffoli Gate</strong> (or Controlled-Controlled-NOT). It takes three input bits and flips the third bit if and only if the first two are 1. It preserves the first two bits, allowing us to reconstruct the input from the output, thus making it fully reversible. This gate is the bridge between classical logic and quantum circuits.</p>
                `,
                quiz: [{ question: "Why must quantum gates be reversible?", options: ["To save energy", "Quantum evolution is unitary", "They are faster", "They are not reversible"], correct: 1, explanation: "In quantum mechanics, evolution is described by unitary operators, which are always mathematically invertible." }]
            },
            {
                title: "0.4 Complexity Classes (P vs NP)",
                content: `
                <h3>Measuring Difficulty</h3>
                <p>In computer science, we classify problems based on how resources (like time or memory) scale as the input size grows. This is known as <strong>Computational Complexity Theory</strong>.</p>
                <h3>Class P (Polynomial Time)</h3>
                <p>These are problems that can be solved efficiently by a classical computer. "Efficiently" means the time required grows polynomially with the input size ($n^2$, $n^3$, etc.). Examples include multiplication, sorting a list, or finding the shortest path on a map.</p>
                <h3>Class NP (Nondeterministic Polynomial)</h3>
                <p>These are problems where, if you are given a solution, you can <em>verify</em> it efficiently, even if finding the solution is incredibly hard. A classic example is Sudoku. Solving a giant Sudoku puzzle is hard, but checking if a completed grid is correct is instant. Another example is integer factorization: finding factors of a giant number is hard, but checking if two numbers multiply to equal it is easy.</p>
                <h3>The Quantum Class: BQP</h3>
                <p>Quantum computers introduce a new complexity class called <strong>BQP</strong> (Bounded-Error Quantum Polynomial time). These are problems solvable efficiently by a quantum computer. We know that BQP contains P, and we suspect BQP is larger than P (meaning QCs can solve things classical computers can't, like Factoring). However, importantly, most experts believe BQP does <em>not</em> contain all of NP. This means quantum computers are likely not "magic boxes" that can solve NP-Complete problems (like the Traveling Salesman) instantly. They are specialized machines that offer exponential speedups for a specific subset of hidden-structure problems.</p>
                `,
                quiz: [{ question: "Which class contains problems solvable efficiently by a classical computer?", options: ["P", "NP", "BQP", "EXPTIME"], correct: 0 }]
            },
            {
                title: "0.5 The Von Neumann Bottleneck",
                content: `
                <h3>Separation of Church and State</h3>
                <p>Almost every computer built since the 1940s follows the <strong>Von Neumann Architecture</strong>. In this design, there is a distinct physical separation between the Central Processing Unit (CPU) and the Memory (RAM). Data must be fetched from memory, traveled across a bus to the CPU, processed, and then sent back to memory.</p>
                <p>As processors have become faster and faster, this data transfer has not kept up, creating a significant performance limit known as the <strong>Von Neumann Bottleneck</strong>. The CPU spends a vast amount of time simply waiting for data to arrive. It's like having a Ferrari engine but being stuck in gridlock traffic.</p>
                <h3>The Quantum Difference</h3>
                <p>Quantum computers often blur this line. In many implementations (like trapped ions or superconducting circuits), the qubits <em>are</em> the memory, and we perform logic gates by applying pulses directly to those qubits. We don't fetch a qubit, move it to a processor, and put it back. We process the information right where it lives. While this introduces its own challenges (control wiring, crosstalk), it represents a fundamental shift in how we think about the architecture of computing machines.</p>
                `,
                quiz: [{ question: "What is the Von Neumann Bottleneck?", options: ["Too much heat", "Separation of CPU and Memory", "Slow transistors", "Limited disk space"], correct: 1 }]
            },
            {
                title: "0.6 Landauer's Principle",
                content: `
                <h3>The Physics of Information</h3>
                <p>For decades, physicists wondered: is there a minimum energy cost to computation? In 1961, Rolf Landauer at IBM demonstrated a profound connection between thermodynamics and information theory. He proved that logical irreversibility implies physical irreversibility.</p>
                <p><strong>Landauer's Principle</strong> states that erasing one bit of information (a logically irreversible operation) must necessarily dissipate a minimum amount of heat energy into the environment. This minimum is $k_B T \\ln 2$ joules, where $k_B$ is Boltzmann's constant and $T$ is the temperature. While this amount is tiny (about $3 \\times 10^{-21}$ joules at room temperature), it sets a fundamental "lower limit" on the power consumption of classical microchips. As we pack billions of transistors closer together, this heat becomes a massive problem.</p>
                <p>Because quantum computing is fundamentally unitary and therefore reversible, it dramatically circumvents this issue. In principle, a reversible quantum computation could be performed with zero energy dissipation (ignoring control overhead). This suggests that reversible computing is not just a mathematical trick for quantum mechanics, but the only path forward for efficient future computing technologies.</p>
                `,
                quiz: [{ question: "Erasing information releases:", options: ["Photons", "Heat/Energy", "Cold", "Nothing"], correct: 1 }]
            }
        ]
    },
    {
        title: "1. Quantum Fundamentals",
        subsections: [
            {
                title: "1.1 The Quantum Leap",
                content: `
                <h3>The Ultraviolet Catastrophe</h3>
                <p>By the late 19th century, physics seemed almost complete. Classical mechanics and Maxwell's electromagnetism explained the universe beautifully—or so we thought. There were a few "small clouds" on the horizon, one of which was the problem of Black Body Radiation. Classical theory predicted that an ideal black body should radiate infinite energy at high frequencies (UV light), a clearly absurd result dubbed the "Ultraviolet Catastrophe."</p>
                <h3>Enter Max Planck</h3>
                <p>In 1900, German physicist Max Planck solved this by making a desperate, "purely formal" assumption: what if energy is not continuous, like a flowing liquid, but discrete, like distinct packets? He called these packets <strong>quanta</strong>. He proposed that energy comes in chunks proportional to frequency: $E = hf$.</p>
                <h3>Einstein's Photons</h3>
                <p>A few years later, in 1905, Albert Einstein took this idea seriously. He proposed that light <em>itself</em> consists of these packets, which we now call <strong>photons</strong>. This explained the Photoelectric Effect (where light knocks electrons off metal) in a way classical waves never could. This marked the birth of Quantum Mechanics—a physics of granularity, where nature is pixelated at the smallest scales.</p>
                `,
                quiz: [{ question: "Who proposed the quantization of light (photons)?", options: ["Newton", "Einstein", "Bohr", "Maxwell"], correct: 1 }]
            },
            {
                title: "1.2 Wave-Particle Duality",
                content: `
                <h3>Is it a Wave or a Particle? Yes.</h3>
                <p>One of the most mind-bending discoveries of the 20th century is that strictly categorizing things as "waves" or "particles" is a mistake. They are both. Or rather, they are quantum objects that exhibit properties of both depending on how we measure them.</p>
                <h3>The Double Slit Experiment</h3>
                <p>The definitive proof of this is the Double Slit Experiment. If you fire bullets (particles) at a wall with two slits, you get two piles of bullets behind the slits. If you send water waves, you get an interference pattern (peaks and troughs). But if you fire <strong>single electrons</strong>—one at a time—at the slits, something impossible happens. Over time, an interference pattern builds up on the screen. Each single electron seems to "know" about both slits. It travels as a wave of probability, passes through both slits simultaneously, interferes with itself, and then strikes the screen as a discrete particle.</p>
                <p>This phenomenon, <strong>Wave-Particle Duality</strong>, is the engine of quantum computing. It means we can manipulate the "wave" nature of matter (interference) to perform calculations that would be impossible with simple discrete particles.</p>
                `,
                quiz: [{ question: "What experiment demonstrates wave-particle duality?", options: ["Stern-Gerlach", "Double Slit", "Michelson-Morley", "Photoelectric Effect"], correct: 1 }]
            },
            {
                title: "1.3 The 4 Postulates of QM",
                content: `
                <h3>The Rules of the Game</h3>
                <p>Just as Euclid built geometry on a few axioms, Quantum Mechanics is built on four mathematical postulates. For quantum computing, these are our "kernel" instructions:</p>
                <ol>
                    <li><strong>State Space:</strong> The state of an isolated quantum system is described completely by a unit vector $|\\psi\\rangle$ in a complex vector space called a <strong>Hilbert Space</strong>. This vector encodes all probabilities.</li>
                    <li><strong>Evolution:</strong> The state of a closed quantum system changes over time according to <strong>Unitary transformations</strong>. A state $|\\psi\\rangle$ becomes $U|\\psi\\rangle$. This means the process is linear, reversible, and preserves probabilities.</li>
                    <li><strong>Measurement:</strong> When we measure a system, we don't just "see" the vector. We collapse it. Every observable quantity corresponds to a linear operator. The outcome is probabilistic, the system jumps to a new state (eigenstate), and the outcome is an eigenvalue.</li>
                    <li><strong>Composite Systems:</strong> If you have two quantum systems, the state space of the combined system is the <strong>Tensor Product</strong> of individual spaces: $H_{total} = H_1 \\otimes H_2$. This postulate gives rise to the massive exponential scaling of quantum memory.</li>
                </ol>
                `,
                quiz: [{ question: "How do closed quantum systems evolve?", options: ["Randomly", "Unitarily", "Exponentially", "Linearly"], correct: 1 }]
            },
            {
                title: "1.4 Qubits vs Bits",
                content: `
                <h3>The Quantum Bit</h3>
                <p>The <strong>Qubit</strong> is the quantum generalization of the classical bit. While a classical bit is like a coin resting on a table showing either Heads (0) or Tails (1), a qubit is a spinning coin floating in mid-air. It definitely has a state, but that state is not just "Heads" or "Tails."</p>
                <p>Mathematically, a qubit is a vector: $|\\psi\\rangle = \alpha|0\\rangle + \beta|1\\rangle$.</p>
                <p>Here, $\alpha$ and $\beta$ are complex numbers called probability amplitudes. The "amount" of 0-ness and 1-ness is stored in these coefficients. When we measure the qubit, we don't get $\alpha$; we get '0' with probability $|\alpha|^2$ or '1' with probability $|\beta|^2$. Since probabilities must sum to 100%, we have the constraint $|\alpha|^2 + |\beta|^2 = 1$.</p>
                <p>This means a qubit can store a continuous range of information (the values of $\alpha$ and $\beta$) effectively "hidden" from direct view. Nature allows us to manipulate these continuous variables for computation, even though we can only extract a single binary bit of information at the very end.</p>
                <div class="vis-container" data-bloch="0"></div>
                `,
                quiz: [{ question: "What defines a pure qubit state?", options: ["1 bit", "Unit vector in Hilbert space", "Floating point number", "Integer"], correct: 1 }]
            },
            {
                title: "1.5 Superposition",
                content: `
                <h3>Being "Everywhere" at Once</h3>
                <p>When $\alpha$ and $\beta$ are both non-zero, we say the qubit is in <strong>superposition</strong>. The most famous example is the state $|+\\rangle = \\frac{|0\\rangle + |1\\rangle}{\\sqrt{2}}$. In this state, the qubit is not 0, and it is not 1. It is exactly halfway between them. If you measured a million such qubits, 50% would report '0' and 50% would report '1'.</p>
                <p>Crucially, this is distinct from simply "not knowing" the value. If I hide a coin in my hand, it is physically either Heads or Tails, I just don't know which. A qubit in superposition is <em>fundamentally</em> undefined. It has no definite value until the moment of measurement.</p>
                <p>Superposition is what allows quantum computers to process massive amounts of possibilities simultaneously. If we have a register of 3 qubits, we can prepare them in a superposition of all 8 possible numbers (0 to 7) at the same time. A single operation on this register affects all 8 values in parallel. This parallelism is the first ingredient of quantum speedup.</p>
                <div class="vis-container" data-bloch="+"></div>
                `,
                quiz: [{ question: "Which gate creates superposition from |0>?", options: ["X", "Z", "H", "CNOT"], correct: 2 }]
            },
            {
                title: "1.6 Quantum Tunneling",
                content: `
                <h3>Walking Through Walls</h3>
                <p>In classical physics, if you roll a ball up a hill and it doesn't have enough speed (energy) to reach the top, it will roll back down. It can never get to the other side. The hill represents an energy barrier.</p>
                <p>In quantum mechanics, particles are waves. And waves don't stop abruptly; they have "tails" that extend into barriers. If the barrier is thin enough, the "tail" of the wave function might extend all the way to the other side. This means there is a non-zero probability that the particle will simply disappear from one side of the hill and reappear on the other, as if it tunneled through the mountain.</p>
                <p>This phenomenon, <strong>Quantum Tunneling</strong>, is not just theoretical sci-fi. It is happening right now in the device you are reading this on. Flash memory (SD cards, SSDs) works by trapping electrons behind an insulator. To erase the memory, we apply a voltage that forces electrons to tunnel out. Without quantum tunneling, standard modern electronics would not exist. In quantum computing, specifically Quantum Annealing (like D-Wave systems), we use tunneling to let the system "tunnel" through energy barriers to find the global minimum (the best solution) of a complex optimization problem.</p>
                `,
                quiz: [{ question: "Tunneling allows particles to:", options: ["Pass through barriers", "Stop moving", "Gain infinite mass", "Teleport far away"], correct: 0 }]
            }
        ]
    },
    {
        title: "2. Mathematical Framework",
        subsections: [
            {
                title: "2.1 Complex Numbers",
                content: `
                <h3>The Language of Amplitudes</h3>
                <p>You cannot do quantum mechanics with just real numbers. The underlying fabric of the theory is built on <strong>Complex Numbers</strong>. A complex number is typically written as $z = a + bi$, where $i = \\sqrt{-1}$.</p>
                <p>In quantum computing, these act as our "probability amplitudes". They describe the state of the system before measurement. While probabilities must always be positive real numbers (you can't have a -50% chance), amplitudes can be negative or even imaginary. This is critical because it allows for <strong>interference</strong>.</p>
                <p>Think of it like adding waves on a pond. If a peak (positive amplitude) meets a trough (negative amplitude), they can cancel each other out to zero. If we only had positive probabilities, things would always add up. Complex amplitudes allow incorrect answers to cancel themselves out (destructive interference) while correct answers amplify each other (constructive interference).</p>
                `,
                quiz: [{ question: "If amplitude is i/sqrt(2), what is probability?", options: ["0.5", "1", "-0.5", "0"], correct: 0 }]
            },
            {
                title: "2.2 Linear Algebra: Vectors",
                content: `
                <h3>Dirac Notation (Bra-Ket)</h3>
                <p>Quantum states are vectors. To distinguish them from regular geometry, physicist Paul Dirac invented a clever notation called <strong>Bra-Ket</strong> notation. It splits the brackets $\\langle \\rangle$ into two parts:</p>
                <ul>
                    <li>The <strong>Ket</strong> $|v\\rangle$: This represents a column vector. It is the standard state of a system.</li>
                    <li>The <strong>Bra</strong> $\\langle v|$: This represents a row vector. specifically, the <em>conjugate transpose</em> of the Ket.</li>
                </ul>
                <p>This notation simplifies complex vector calculus into simple algebra. For example, applying a matrix $M$ to a vector $|v\\rangle$ is written simply as $M|v\\rangle$. The "conjugate transpose" part (turning columns to rows and flipping the sign of imaginary parts) is vital for calculating probabilities, defined by the inner product $\\langle v|v\\rangle$.</p>
                `,
                quiz: [{ question: "What is the conjugate transpose of |v>?", options: ["|v>", "<v|", "-|v>", "v"], correct: 1 }]
            },
            {
                title: "2.3 Mathematical Matrices",
                content: `
                <h3>Operators are Matrices</h3>
                <p>If states are vectors, then operations (gates) are <strong>Matrices</strong>. A single qubit is a 2-element vector, so single-qubit gates are $2 \\times 2$ matrices. To find out what a gate does to a qubit, we perform matrix multiplication.</p>
                <p>For example, the X-Gate (NOT gate) is defined as:
                $$ X = \\begin{bmatrix} 0 & 1 \\\\ 1 & 0 \\end{bmatrix} $$
                If we apply this to the state $|0\\rangle$ (which is $\\begin{bmatrix} 1 \\\\ 0 \\end{bmatrix}$):
                $$ X|0\\rangle = \\begin{bmatrix} 0 & 1 \\\\ 1 & 0 \\end{bmatrix} \\begin{bmatrix} 1 \\\\ 0 \\end{bmatrix} = \\begin{bmatrix} 0 \\\\ 1 \\end{bmatrix} = |1\\rangle $$
                It successfully flipped the bit! Understanding matrix multiplication is the primary math skill needed to simulate quantum circuits by hand.</p>
                <div class="matrix-container" data-matrix="X"></div>
                `,
                quiz: [{ question: "Quantum gates are represented by:", options: ["Scalars", "Matrices", "Graphs", "Trees"], correct: 1 }]
            },
            {
                title: "2.4 Inner Products",
                content: `
                <h3>Measuring Overlap</h3>
                <p>The <strong>Inner Product</strong> (or dot product) of two quantum states tells us how "similar" they are. In Bra-Ket notation, it looks like a "bracket": $\\langle a | b \\rangle$.</p>
                <p>The result is a single complex number (a scalar).
                <ul>
                    <li>If $\\langle a | b \\rangle = 1$, the states are identical (normalized).</li>
                    <li>If $\\langle a | b \\rangle = 0$, the states are <strong>Orthogonal</strong>. This is crucial. Orthogonal states are perfectly distinguishable. For example, $|0\\rangle$ and $|1\\rangle$ are orthogonal. We can measure them and verify with 100% certainty which one we have.</li>
                    <li>If the value is somewhere in between (e.g., 0.5), it means the states overlap. If you measure state $|a\\rangle$ asking "Prompt: Are you $|b\\rangle$?", there is a probability $|\\langle b|a\\rangle|^2$ of saying "Yes".</li>
                </ul>
                This geometric interpretation—states as arrows in a high-dimensional space—is often more intuitive than abstract algebra.</p>
                `,
                quiz: [{ question: "If <a|b> = 0, the states are:", options: ["Identical", "Orthogonal", "Entangled", "Parallel"], correct: 1 }]
            },
            {
                title: "2.5 Tensor Products",
                content: `
                <h3>The Source of Exponential Power</h3>
                <p>How do we describe two qubits mathematically? We don't just add their vectors. We multiply them using the <strong>Tensor Product</strong> (symbol $\\otimes$).</p>
                <p>If qubit A has dimension 2 and qubit B has dimension 2, the combined system has dimension $2 \\times 2 = 4$. If we have $n$ qubits, the dimension is $2 \\times 2 \\times ... \\times 2 = 2^n$.</p>
                <p>This scaling is explosive.
                <ul>
                    <li>10 qubits: 1,024 states.</li>
                    <li>20 qubits: ~1 million states.</li>
                    <li>50 qubits: $10^{15}$ states (Petabyte scale).</li>
                    <li>300 qubits: More states than there are atoms in the observable universe.</li>
                </ul>
                This is why we cannot simulate large quantum computers on classical machines. The vector simply becomes too large to store in memory. A 300-qubit calculator would require a classical memory "hard drive" made of all the matter in the universe just to write down its state once.</p>
                `,
                quiz: [{ question: "What is the dimension of 3 qubits?", options: ["3", "6", "8", "9"], correct: 2 }]
            },
            {
                title: "2.6 Eigenvalues & Eigenvectors",
                content: `
                <h3>The Spectrum of Observables</h3>
                <p>Linear algebra dictates that for any square matrix, there are special vectors that don't change direction when multiplied by that matrix; they only stretch or shrink. These are <strong>Eigenvectors</strong>. The amount they stretch is the <strong>Eigenvalue</strong>.</p>
                <p>$$ A|v\\rangle = \\lambda|v\\rangle $$</p>
                <p>This abstract math implies deep physics. In Quantum Mechanics, every measurement corresponds to a matrix operator. The <strong>Eigenvalues</strong> of that matrix are the <em>only possible results</em> of the measurement. You can never measure a value that isn't an eigenvalue.</p>
                <p>For example, the Z-operator has eigenvalues +1 and -1 (corresponding to states $|0\\rangle$ and $|1\\rangle$). When we measure a qubit's Z-spin, we will only ever find +1 or -1. We will never find 0.5. The universe is constrained by the eigenspectrum of its operators.</p>
                `,
                quiz: [{ question: "Measurement outcomes correspond to:", options: ["Eigenvalues", "Matrix traces", "Determinants", "Complex conjugates"], correct: 0 }]
            },
            {
                title: "2.7 Hermitian Operators",
                content: `
                <h3>Real World Results</h3>
                <p>Observables (things we can measure like position, momentum, spin, energy) must yield real numbers. It makes no sense to say "The energy is $5i$ Joules." Therefore, the matrices representing these observables must have a special property: their eigenvalues must all be real numbers.</p>
                <p>Matrices with this property are called <strong>Hermitian Matrices</strong>. A matrix $H$ is Hermitian if it is equal to its conjugate transpose ($H = H^\\dagger$). This is the mathematical safety check that ensures our quantum theory predicts measurable, real-world quantities. In fact, the Hamiltonian operator (which represents the total energy of the system) is the most famous Hermitian operator, driving the famous Schrödinger Equation.</p>
                `,
                quiz: [{ question: "Hermitian matrices have ___ eigenvalues.", options: ["Imaginary", "Real", "Negative", "Variable"], correct: 1 }]
            }
        ]
    },
    {
        title: "3. Single Qubit Operations",
        subsections: [
            {
                title: "3.1 The Bloch Sphere",
                content: `
                <h3>Visualizing the Qubit</h3>
                <p>Since a single qubit is described by complex numbers, it's hard to visualize. We can't draw in 4 dimensions. However, using a clever mathematical mapping, we can represent the state of any single qubit as a point on the surface of a sphere with radius 1: the <strong>Bloch Sphere</strong>.</p>
                <ul>
                    <li>The North Pole represents $|0\\rangle$.</li>
                    <li>The South Pole represents $|1\\rangle$.</li>
                    <li>Points on the equator (like $|+\\rangle$) represent equal superpositions.</li>
                </ul>
                <p>This visualization is incredibly powerful for intuition. Quantum gates correspond to rotations of this sphere. An X-gate rotates 180 degrees around the X-axis (flipping North to South). A Z-gate rotates around the Z-axis (spinning the sphere like a globe). While this picture breaks down for entangled multiple qubits, for single qubits, it is the gold standard of visualization.</p>
                <div class="vis-container" data-bloch="0"></div>
                `,
                quiz: [{ question: "Where do pure states live on the Bloch sphere?", options: ["Center", "Surface", "Outside", "North Pole only"], correct: 1 }]
            },
            {
                title: "3.2 Pauli Matrices (X, Y, Z)",
                content: `
                <h3>The Logical Axes</h3>
                <p>The Pauli matrices are a set of three $2 \\times 2$ complex matrices that are Hermitian and Unitary. They form the "x, y, z" axes of the quantum world.</p>
                <ul>
                    <li><strong>Pauli-X (NOT Gate)</strong>: Swaps amplitudes of $|0\\rangle$ and $|1\\rangle$. On the Bloch sphere, it rotates 180° around the X-axis. Used classically as a bit-flip error or operation.</li>
                    <li><strong>Pauli-Y</strong>: Maps $|0\\rangle \\to i|1\\rangle$ and $|1\\rangle \\to -i|0\\rangle$. It combines a bit flip and a phase shift.</li>
                    <li><strong>Pauli-Z (Phase Gate)</strong>: Leaves $|0\\rangle$ alone but flips the sign of $|1\\rangle$ ($|1\\rangle \\to -|1\\rangle$). This is a phase flip. In classical computing, there is no such thing as a "phase flip," making this uniquely quantum.</li>
                </ul>
                <div class="matrix-container" data-matrix="X"></div>
                `,
                quiz: [{ question: "Which Pauli gate corresponds to a NOT operation?", options: ["X", "Y", "Z", "I"], correct: 0 }]
            },
            {
                title: "3.3 Hadamard Gate",
                content: `
                <h3>The Superposition Maker</h3>
                <p>The <strong>Hadamard Gate (H)</strong> is arguably the most important single-qubit gate in quantum algorithms. We often start algorithms by initializing all qubits to $|0\\rangle$ and applying H gates to all of them. Why?</p>
                <p>The H gate transforms the basic state $|0\\rangle$ into the superposition state $|+\\rangle = \\frac{|0\\rangle + |1\\rangle}{\\sqrt{2}}$. It puts the qubit into a state of "equal probability." It moves the state from the North Pole to the Equator of the Bloch sphere. If you apply H again, it interferes the superposition back into the deterministic state $|0\\rangle$. $(H \\times H = I)$.</p>
                <p>This gate is the tool we use to open the door to exponential parallelism. By applying H to $n$ qubits, we create a superposition of all $2^n$ possible binary strings with just $n$ operations.</p>
                <div class="matrix-container" data-matrix="H"></div>
                `,
                quiz: [{ question: "H|0> = ?", options: ["|0>", "|1>", "|+>", "|->"], correct: 2 }]
            },
            {
                title: "3.4 Phase & T Gates",
                content: `
                <h3>Finer Rotations</h3>
                <p>While X, Y, Z, and H are great, they only cover 90 or 180-degree turns. To execute arbitrary algorithms, we need finer control.</p>
                <ul>
                    <li><strong>S Gate (Phase Gate)</strong>: Performs a 90-degree rotation around the Z-axis. It is the square root of Z ($\\sqrt{Z}$).</li>
                    <li><strong>T Gate ($\\pi/8$ Gate)</strong>: Performs a 45-degree rotation around the Z-axis. It is the square root of S, or the fourth root of Z.</li>
                </ul>
                <p>The <strong>T Gate</strong> holds special significance. Many common error-correcting codes perform Clifford gates (H, S, CNOT) easily, but the T gate is very hard ("costly") to implement fault-tolerantly. However, the T gate is <em>required</em> to make the gate set universal. Without it, your quantum computer is just a fancy classical simulator.</p>
                <div class="matrix-container" data-matrix="T"></div>
                `,
                quiz: [{ question: "Which gate is the 4th root of Z?", options: ["S", "T", "H", "X"], correct: 1 }]
            },
            {
                title: "3.5 Rotations",
                content: `
                <h3>Navigating the Sphere</h3>
                <p>To reach any point on the Bloch sphere, we define generalized rotation operators: $R_x(\\theta)$, $R_y(\\theta)$, and $R_z(\\theta)$. These gates rotate the state vector by an arbitrary angle $\\theta$ around the specified axis.</p>
                <p>With these, we can construct any single-qubit unitary $U$. For example, an arbitrary state preparation usually involves rotating the qubit from $|0\\rangle$ to the desired latitude via $R_y$ and longitude via $R_z$. In physical hardware, these continuous rotations are often implemented by controlling the duration and phase of a microwave pulse sent to the qubit. A longer pulse rotates it further; a phase-shifted pulse rotates it around a different axis.</p>
                `,
                quiz: [{ question: "How many parameters define a pure qubit state (ignoring global phase)?", options: ["1", "2", "3", "4"], correct: 1, explanation: "Theta (latitude) and Phi (longitude) on the Bloch sphere." }]
            },
            {
                title: "3.6 The Clifford Group",
                content: `
                <h3>The "Easy" Gates</h3>
                <p>The Clifford Group is a set of gates generated by {H, S, CNOT, Pauli}. These gates are very well-behaved. They map Pauli operators to other Pauli operators. Because of this structure, circuits made entirely of Clifford gates can be efficiently simulated on a classical computer, even for thousands of qubits. This surprising result is the <strong>Gottesman-Knill Theorem</strong>.</p>
                <p>This tells us something profound about the source of quantum power: Superposition and Entanglement alone are <em>not enough</em> for exponential speedup (since CNOT creates entanglement and H creates superposition). To get true quantum advantage, you need to break out of the Clifford group. You need a "non-Clifford" gate, typically the <strong>T Gate</strong>. This makes the T gate the "magic ingredient" that makes quantum computing strictly more powerful than classical computing.</p>
                `,
                quiz: [{ question: "Which theorem states Clifford circuits are easy to simulate?", options: ["Gottesman-Knill", "Bell's Theorem", "Shor's Theorem", "No-Cloning"], correct: 0 }]
            }
        ]
    },
    {
        title: "4. Multi-Qubit Systems",
        subsections: [
            {
                title: "4.1 Tensor Products of Qubits",
                content: `
                <h3>Combining Systems</h3>
                <p>When we move from one qubit to two, the math shifts from the Bloch Sphere to the <strong>Tensor Product</strong>. If Qubit A is in state $|0\\rangle$ and Qubit B is in state $|1\\rangle$, the system state is written as $|0\\rangle \\otimes |1\\rangle$, or simply $|01\\rangle$.</p>
                <p>In a 2-qubit system, the basis states are $|00\\rangle, |01\\rangle, |10\\rangle, |11\\rangle$. A general quantum state is a superposition of all four:
                $$ |\\psi\\rangle = c_0|00\\rangle + c_1|01\\rangle + c_2|10\\rangle + c_3|11\\rangle $$
                Where $|c_0|^2 + ... + |c_3|^2 = 1$.
                Wait, this looks just like a 4-dimensional vector! And it is. For $N$ qubits, the vector has $2^N$ entries. This exponential growth is why "just adding one more qubit" actually doubles the complexity of the computer state.</p>
                `,
                quiz: [{ question: "If q1 is |0> and q2 is |1>, the system is:", options: ["|0>+|1>", "|01>", "|10>", "0"], correct: 1 }]
            },
            {
                title: "4.2 Entanglement",
                content: `
                <h3>Spooky Action</h3>
                <p>Here is the weird part. Some states in this 4D space <em>cannot</em> be written as "Qubit A is here AND Qubit B is there."</p>
                <p>Consider the Bell State: $|\\Phi^+\\rangle = \\frac{|00\\rangle + |11\\rangle}{\\sqrt{2}}$.
                Can you find a state for A ($a_0|0\\rangle + a_1|1\\rangle$) and B ($b_0|0\\rangle + b_1|1\\rangle$) that multiplies out to this? No.</p>
                <p>In this state, the qubits have lost their individual identities. There is no "state of Qubit A" anymore. There is only the state of the pair. They are <strong>Entangled</strong>. If you measure Qubit A and find '0', the state instantly collapses to $|00\\rangle$, meaning Qubit B <em>must</em> be '0'. If A is '1', B is '1'. Their outcomes are perfectly correlated, instantaneously, regardless of distance. Einstein famously called this "Spooky action at a distance," and it is the resource powering teleportation and quantum cryptography.</p>
                `,
                quiz: [{ question: "Can an entangled state be written as a product of individual qubits?", options: ["Yes", "No", "Sometimes", "Only for bosons"], correct: 1 }]
            },
            {
                title: "4.3 The Bell States",
                content: `
                <h3>The Gold Standard of Entanglement</h3>
                <p>The Bell States are four specific maximally entangled 2-qubit states. They form an orthonormal basis for the 2-qubit Hilbert space.</p>
                <ul>
                    <li>$|\\Phi^+\\rangle = (|00\\rangle + |11\\rangle)/\\sqrt{2}$</li>
                    <li>$|\\Phi^-\\rangle = (|00\\rangle - |11\\rangle)/\\sqrt{2}$</li>
                    <li>$|\\Psi^+\\rangle = (|01\\rangle + |10\\rangle)/\\sqrt{2}$</li>
                    <li>$|\\Psi^-\\rangle = (|01\\rangle - |10\\rangle)/\\sqrt{2}$</li>
                </ul>
                <p>These states are the currency of quantum information protocols. If Alice and Bob share a Bell pair, they can perform Superdense Coding (sending 2 bits with 1 qubit) or Quantum Teleportation. Creating high-fidelity Bell pairs is the first benchmark test for any new quantum computer hardware.</p>
                `,
                quiz: [{ question: "Measuring one qubit of a Bell pair...", options: ["Does nothing to the other", "Instantly determines the state of the other", "Destroys the universe", "Flips the other"], correct: 1 }]
            },
            {
                title: "4.4 Multiparticle States (GHZ)",
                content: `
                <h3>Beyond Two Qubits</h3>
                <p>Entanglement isn't limited to pairs. You can entangle 3, 4, or a million particles. A famous example is the <strong>GHZ State</strong> (Greenberger-Horne-Zeilinger state):</p>
                <p>$$ |\\text{GHZ}\\rangle = \\frac{|000\\rangle + |111\\rangle}{\\sqrt{2}} $$</p>
                <p>This is a "Schrödinger's Cat" state where three qubits are all 0 or all 1. Measuring just one of them immediately collapses the other two. GHZ states are extremely fragile; if you lose just one qubit to the environment (decoherence), the entanglement of the whole group is destroyed. Contrasted with <strong>W States</strong> ($|001\\rangle + |010\\rangle + |100\\rangle$), which retain some entanglement even if a qubit is lost, GHZ states illustrate the rich complexity and fragility of multipartite quantum systems.</p>
                `,
                quiz: [{ question: "How many qubits are in a GHZ state?", options: ["2", "3+", "1", "0"], correct: 1 }]
            },
            {
                title: "4.5 Density Matrices",
                content: `
                <h3>Dealing with Uncertainty</h3>
                <p>So far, we've assumed we know everything about the quantum state (Pure States, vectors). But what if our hardware is noisy? What if we have a 50% chance of having state $|0\\rangle$ and a 50% chance of having $|1\\rangle$? This is NOT the same as superposition ($|+\\rangle$). This is classical ignorance mixed with quantum uncertainty.</p>
                <p>To describe this, we use the <strong>Density Matrix</strong> $\rho$.
                $$ \rho = \sum_i p_i |\psi_i\\rangle\\langle\psi_i| $$
                where $p_i$ is the classical probability of being in state $|\psi_i\\rangle$. The density matrix is the most general description of a quantum system.
                <ul>
                    <li>For a Pure State, $\\text{Tr}(\rho^2) = 1$.</li>
                    <li>For a Mixed State (noisy), $\\text{Tr}(\rho^2) < 1$.</li>
                </ul>
                Mastering density matrices is essential for understanding quantum noise, decoherence, and error correction.</p>
                `,
                quiz: [{ question: "What represents a mixed quantum state?", options: ["State vector", "Density Matrix", "Scalar", "String"], correct: 1 }]
            },
            {
                title: "4.6 Schmidt Decomposition",
                content: `
                <h3>Quantifying Entanglement</h3>
                <p>How do we know if a state is entangled? For pure states, we can use the <strong>Schmidt Decomposition</strong>. It tells us that any pure state of a bipartite (two-part) system can be written as a sum of bi-orthogonal pairs:</p>
                <p>$$ |\\psi\\rangle = \sum_i \lambda_i |i\rangle_A \\otimes |i\rangle_B $$</p>
                <p>The coefficients $\lambda_i$ are real numbers called Schmidt coefficients.
                The number of non-zero coefficients is the <strong>Schmidt Rank</strong>.</p>
                <ul>
                    <li>If Rank = 1, the state is a product state (Separable). Not entangled.</li>
                    <li>If Rank > 1, the state is Entangled.</li>
                </ul>
                <p>This provides a rigorous mathematical "litmus test" for entanglement. It also reveals that the entanglement between two systems is essentially determined by the "single-qubit information" (reduced density matrix) of just one half of the pair.</p>
                `,
                quiz: [{ question: "If Schmidt Rank is > 1, the state is:", options: ["Entangled", "Separable", "Mixed", "Zero"], correct: 0 }]
            }
        ]
    },
    {
        title: "5. Quantum Circuits",
        subsections: [
            {
                title: "5.1 Circuit Diagrams",
                content: `
                <h3>Reading the Music Score</h3>
                <p>Quantum algorithms are typically written as <strong>Circuit Diagrams</strong>, which look a bit like musical scores.</p>
                <ul>
                    <li><strong>Horizontal Lines</strong> represent qubits (wires in a circuit). They represent the passage of time, flowing from left to right.</li>
                    <li><strong>Boxes</strong> on the lines represent Gates (operations) applied to those qubits.</li>
                    <li><strong>Vertical Lines</strong> connecting qubits represent multi-qubit interactions (like controls).</li>
                    <li><strong>Measurement</strong> is often shown as a meter symbol at the far right, converting the quantum line (single wire) into a classical line (double wire).</li>
                </ul>
                <p>Just like reading music, learning to read these diagrams allows you to replay the algorithm in your head. You trace the state vector step-by-step from left to right as it evolves through the unitary transformations.</p>
                `,
                quiz: [{ question: "In circuit diagrams, time flows:", options: ["Top to Bottom", "Right to Left", "Left to Right", "Bottom to Top"], correct: 2 }]
            },
            {
                title: "5.2 CNOT Gate",
                content: `
                <h3>The Fundamental 2-Qubit Gate</h3>
                <p>The <strong>CNOT (Controlled-NOT)</strong> gate is the workhorse of quantum logic. It takes very distinct roles for its two input qubits:</p>
                <ul>
                    <li><strong>Control Qubit (top):</strong> Acts as the "IF" condition. It never changes its state in the standard basis.</li>
                    <li><strong>Target Qubit (bottom):</strong> Acts as the "THEN" action. If the Control is $|1\\rangle$, the Target is flipped (X-gate applied). If Control is $|0\\rangle$, Target is left alone.</li>
                </ul>
                <p>While this sounds like a classical ` + "`if`" + ` statement, it becomes magical when the Control is in <strong>superposition</strong>. If Control is $\\frac{|0\\rangle + |1\\rangle}{\\sqrt{2}}$ and Target is $|0\\rangle$, the CNOT produces the Bell State: $\\frac{|00\\rangle + |11\\rangle}{\\sqrt{2}}$. The target flips "halfway", becoming entangled with the control. This ability to entangle qubits is what makes CNOT essential for universality.</p>
                <div class="matrix-container" data-matrix="CX" data-qubits="2"></div>
                `,
                quiz: [{ question: "CNOT |10> = ?", options: ["|10>", "|11>", "|00>", "|01>"], correct: 1 }]
            },
            {
                title: "5.3 Multi-Control Gates (Toffoli)",
                content: `
                <h3>Quantum AND Gate</h3>
                <p>The CNOT is reversible. But what about standard logical operations like AND? To perform these, we need 3 qubits. The <strong>Toffoli Gate</strong> (CCNOT) has two controls and one target. It flips the target if and only if <em>both</em> controls are 1.</p>
                <p>This gate is computationally <strong>Universal</strong> for classical reversible functions. You can build any classical computer program using only Toffoli gates. In quantum circuits, Toffoli gates are often used to implement arithmetic (adders, multipliers) or oracles. However, they are expensive. Decomposing a Toffoli gate into native 1- and 2-qubit gates requires 6 CNOTs and several T gates, making it a costly component in error-corrected circuits.</p>
                `,
                quiz: [{ question: "The Toffoli gate has how many control qubits?", options: ["1", "2", "3", "0"], correct: 1 }]
            },
            {
                title: "5.4 Swap and Fredkin",
                content: `
                <h3>Moving Information</h3>
                <p>In classical chips, moving bits is easy—just route a wire. In some quantum architectures (like superconducting chips), qubits are physically fixed in place. They can only talk to their nearest neighbors. To "move" a quantum state from one side of the chip to the other, we must use <strong>SWAP Gates</strong>.</p>
                <p>A SWAP gate simply exchanges the states of two qubits: $|a\\rangle|b\\rangle \\to |b\\rangle|a\\rangle$. Usually, a SWAP is built from 3 CNOT gates.</p>
                <p>A more advanced version is the <strong>Fredkin Gate (CSWAP)</strong>. It swaps two target qubits if and only if a control qubit is 1. Like the Toffoli, the Fredkin gate is also universal for reversible computing and plays a key role in algorithms for comparing quantum states (Swap Test).</p>
                <div class="matrix-container" data-matrix="SWAP" data-qubits="2"></div>
                `,
                quiz: [{ question: "Fredkin gate is also known as:", options: ["CCNOT", "CSWAP", "ISWAP", "Hadamard"], correct: 1 }]
            },
            {
                title: "5.5 No-Cloning Theorem",
                content: `
                <h3>You Cannot Copy-Paste</h3>
                <p>In the classical world, information is free. You can copy a file a million times. We take this for granted.</p>
                <p>In 1982, Wootters and Zurek proved a shocking theorem: <strong>It is impossible to create an exact copy of an arbitrary unknown quantum state.</strong></p>
                <p>The <strong>No-Cloning Theorem</strong> states that there is no unitary $U$ such that $U(|\\psi\\rangle|0\\rangle) = |\\psi\\rangle|\\psi\\rangle$ for all $|\\psi\\rangle$. If you could clone, you could violate the uncertainty principle (measure position on one copy, momentum on the other) or communicate faster than light using entanglement. This theorem is a double-edged sword: it makes quantum error correction extremely difficult (since we can't just backup our data), but it enables unhackable Quantum Cryptography (since an eavesdropper cannot copy the key).</p>
                `,
                quiz: [{ question: "Can you make a perfect copy of an unknown quantum state?", options: ["Yes", "No", "Only if it's |0>", "Only if it's entangled"], correct: 1 }]
            }
        ]
    },
    {
        title: "6. Quantum Protocols",
        subsections: [
            {
                title: "6.1 Superdense Coding",
                content: `
                <h3>Doing More With Less</h3>
                <p>Can you send 2 bits of information by sending only 1 particle? Classically, impossible. Quantumly, yes—if you share entanglement.</p>
                <p>In <strong>Superdense Coding</strong>, Alice and Bob share a Bell pair (previously distributed). Alice wants to send two classical bits (00, 01, 10, or 11) to Bob.</p>
                <ol>
                    <li>If she wants to send 00, she does nothing ($I$ gate).</li>
                    <li>For 01, she applies $Z$.</li>
                    <li>For 10, she applies $X$.</li>
                    <li>For 11, she applies $iY$.</li>
                </ol>
                <p>She then sends her <em>one</em> qubit to Bob. Bob now has both qubits of the pair. He performs a Bell measurement (CNOT then H) and reads out exactly the two bits Alice intended. Two classical bits of info were transmitted by the physical transport of a single qubit. The "extra" information was effectively hiding in the pre-shared entanglement.</p>
                `,
                quiz: [{ question: "Superdense coding sends how many bits per qubit?", options: ["1", "2", "0.5", "Infinite"], correct: 1 }]
            },
            {
                title: "6.2 Teleportation",
                content: `
                <h3>Sci-Fi Made Real</h3>
                <p><strong>Quantum Teleportation</strong> allows us to transfer the exact quantum state $|\\psi\\rangle$ of a particle to a distant location, without physically moving the particle itself. It does <em>not</em> transport matter (like Star Trek); it transports information (state).</p>
                <p>The protocol requires Alice and Bob to share a Bell pair. Alice performs a Bell measurement on her mystery qubit $|\\psi\\rangle$ and her half of the pair. This destroys $|\\psi\\rangle$ (collapsing it), yielding two random classical bits. She calls Bob and tells him these two bits. Bob then applies corrections (X or Z gates) to his half of the pair. Magically, his qubit becomes exactly $|\\psi\\rangle$.</p>
                <p>Key takeaways:</p>
                <ul>
                    <li>The original state is destroyed (No-Cloning is preserved).</li>
                    <li>It is not instantaneous. Alice <em>must</em> send the 2 classical bits for it to work. Thus, information travels at the speed of light, not faster. Causality is safe.</li>
                </ul>
                `,
                quiz: [{ question: " Does teleportation violate logic (FTL)?", options: ["Yes", "No, it requires classical channel", "Yes, spooky", "Maybe"], correct: 1 }]
            },
            {
                title: "6.3 Quantum Key Distribution (BB84)",
                content: `
                <h3>Unhackable Communication</h3>
                <p><strong>BB84</strong> (Bennett and Brassard, 1984) is the first and most famous Quantum Key Distribution (QKD) protocol. It allows two parties to generate a shared secret random key that is proven secure by the laws of physics.</p>
                <p>Alice sends photons prepared in random bases (Rectilinear + or Diagonal x). Bob measures them in random bases. Afterwards, they publicly announce which bases they used (but not the results). They keep the bits where their bases matched.</p>
                <p>If an eavesdropper (Eve) tries to intercept the photons, she must measure them. Because of the uncertainty principle, measuring in the wrong base <em>disturbs</em> the state. This introduces errors. Alice and Bob check a subset of their key for errors. If errors exist, they know Eve is listening, and they discard the key. If no errors exist, the key is mathematically guaranteed to be secret. This technology is already commercially available today.</p>
                `,
                quiz: [{ question: "What is the purpose of BB84?", options: ["Factor numbers", "Search database", "Generate secret keys", "Teleport humans"], correct: 2 }]
            },
            {
                title: "6.4 Entanglement Swapping",
                content: `
                <h3>Entangling Strangers</h3>
                <p>Imagine Alice has a qubit entangled with Bob. And Bob has <em>another</em> qubit entangled with Charlie. Alice and Charlie have never met, and their qubits have never interacted.</p>
                <p>If Bob performs a Bell measurement on his two qubits (one from Alice's pair, one from Charlie's), he destroys the entanglement he had with them, but strangely, Alice's qubit instantly becomes entangled with Charlie's qubit. This is <strong>Entanglement Swapping</strong>.</p>
                <p>This is the core mechanic of a <strong>Quantum Repeater</strong>. In fiber optics, photons are lost over long distances. We can't just amplify them (No-Cloning). Instead, we use swapping to create entanglement over short hops (Alice-Bob, Bob-Charlie) and stitch them together into a long-distance link (Alice-Charlie), enabling a global Quantum Internet.</p>
                `,
                quiz: [{ question: "Entanglement swapping is key for:", options: ["Quantum Repeaters", "Classical Internet", "Mining Bitcoin", "LEDs"], correct: 0 }]
            },
            {
                title: "6.5 Quantum Internet",
                content: `
                <h3>The Network of the Future</h3>
                <p>A <strong>Quantum Internet</strong> is not a faster version of WiFi. It is a proposed network that distributes entanglement rather than just data. It would connect quantum computers, allowing them to work together as a single massive cluster (Distributed Quantum Computing).</p>
                <p>Applications include:</p>
                <ul>
                    <li><strong>Secure Communication:</strong> Global QKD networks secure against any computational attack.</li>
                    <li><strong>Clock Synchronization:</strong> Entangled clocks could synchronize GPS and financial markets with unprecedented precision.</li>
                    <li><strong>Telescopery:</strong> Linking optical telescopes via entanglement (interferometry) to create an aperture the size of the Earth, capable of imaging exoplanets directly.</li>
                </ul>
                <p>Building this requires quantum memory, repeaters, and transducers (to convert matter qubits to flying photon qubits), representing one of the grand engineering challenges of the century.</p>
                `,
                quiz: [{ question: "The primary resource of a quantum internet is:", options: ["Bandwidth", "Entanglement", "Latency", "Voltage"], correct: 1 }]
            }
        ]
    },
    {
        title: "7. Oracular Algorithms",
        subsections: [
            {
                title: "7.1 The Oracle",
                content: `
                <h3>The Black Box</h3>
                <p>Many quantum algorithms are formulated in terms of an <strong>Oracle</strong>. An oracle is a "black box" function $f(x)$ provided to us. We don't know the inner workings of the box; we can only query inputs $x$ and observe outputs.</p>
                <p>In the quantum context, this function is implemented as a unitary operator $U_f$. To be reversible, it typically acts on two registers: $|x\\rangle$ (input) and $|y\\rangle$ (output), transforming them to $|x\\rangle |y \\oplus f(x)\\rangle$.</p>
                <p>Oracular algorithms ask: "How many times do I have to query the black box to find out a property of $f$?" (Query Complexity). While classical computers often need to check every input ($N$ queries), quantum computers can use superposition to feed <em>all possible inputs</em> into the oracle at once. The art lies in extracting useful information from the resulting entangled mess.</p>
                `,
                quiz: [{ question: "An oracle must be:", options: ["Reversible/Unitary", "Random", "Slow", "Classical"], correct: 0 }]
            },
            {
                title: "7.2 Deutsch's Algorithm",
                content: `
                <h3>The First Proof of Concept</h3>
                <p>Proposed by David Deutsch in 1985, this was the first algorithm to show a quantum speedup. The problem is simple: You are given a function $f(x)$ that takes a 1-bit input (0 or 1) and outputs 1 bit (0 or 1). There are only 4 such functions. Two are "Constant" (always 0 or always 1) and two are "Balanced" (0->1, 1->0 or vice versa).</p>
                <p><strong>Goal:</strong> Determine if $f$ is Constant or Balanced.</p>
                <ul>
                    <li><strong>Classical:</strong> You must query $f(0)$ AND $f(1)$. You need <strong>2 queries</strong>.</li>
                    <li><strong>Quantum:</strong> By preparing the input in a superposition $|+\\rangle$ and the target in $|-\\rangle$, the oracle kicks back the function's information into the <em>phase</em> of the input state (Phase Kickback). We can determine the answer with certainty using only <strong>1 query</strong>.</li>
                </ul>
                <p>While saving 1 query isn't groundbreaking, it was the "Hello World" that proved quantum computation could do things classical logic fundamentally could not.</p>
                `,
                quiz: [{ question: "How many queries does Deutsch's algorithm save?", options: ["1", "2", "Many", "None"], correct: 0 }]
            },
            {
                title: "7.3 Deutsch-Jozsa",
                content: `
                <h3>Scaling Up</h3>
                <p>Deutsch-Jozsa (1992) generalizes the previous problem to $n$ bits. We have a function $f$ from $n$ bits to 1 bit. We are promised it is either Constant (all outputs same) or Balanced (50% 0s, 50% 1s).</p>
                <ul>
                    <li><strong>Classical:</strong> In the worst case, you might query half the possible inputs plus one ($2^{n-1} + 1$) before you find a difference. This is exponential time.</li>
                    <li><strong>Quantum:</strong> Using the exact same circuit as Deutsch's algorithm (Hadamards -> Oracle -> Hadamards), we can solve this with exactly <strong>1 query</strong>.</li>
                </ul>
                <p>This provides an exponential separation between classical and quantum query complexity. However, it's a "synthetic" problem (real-world functions aren't usually promised to be constant or balanced), but it paved the way for useful algorithms like Shor's.</p>
                `,
                quiz: [{ question: "Classes: Constant vs...?", options: ["Random", "Balanced", "Linear", "Polynomial"], correct: 1 }]
            },
            {
                title: "7.4 Bernstein-Vazirani",
                content: `
                <h3>Finding the Combination</h3>
                <p>Imagine there is a secret combination code $s$ (a string of $n$ bits) inside a box. The box implements the function $f(x) = x \\cdot s$ (inner product modulo 2).</p>
                <p>Classically, to find an $n$-bit string $s$, you'd have to query "100...0", then "010...0", etc., to reveal one bit at a time. It takes <strong>$n$ queries</strong>.</p>
                <p>With the Bernstein-Vazirani algorithm, we can find the entire secret string $s$ in just <strong>1 query</strong>. By applying Hadamards to all input and output qubits, the oracle transforms the state such that the hidden string $s$ is encoded directly into the measurement outcomes. If $s = 101$, you measure '101' with 100% probability. This demonstrates a polynomial speedup useful for understanding quantum correlations.</p>
                `,
                quiz: [{ question: "Bernstein-Vazirani finds:", options: ["Factors", "Hidden String", "Period", "Minimum"], correct: 1 }]
            },
            {
                title: "7.5 Simon's Algorithm",
                content: `
                <h3>The Precursor to Shor's</h3>
                <p>Proposed by Daniel Simon in 1994, this problem deals with finding a hidden period. We are given a function $f$ that is 2-to-1, meaning $f(x) = f(y)$ if and only if $y = x \\oplus s$ for some secret string $s$. The goal is to find $s$.</p>
                <p>Classically, this is an exponentially hard problem (birthday paradox). You'd need virtually $2^{n/2}$ queries.</p>
                <p>Simon's Algorithm solves it in polynomial time regarding $n$ ($O(n)$ queries). It uses the Hadamard transform to sample random bitstrings $z$ such that $z \\cdot s = 0$. By collecting enough of these linear equations, we can solve for $s$ using Gaussian elimination.</p>
                <p>This was historically massive: it inspired Peter Shor to realize that if quantum computers could find <em>XOR</em> periods (like Simon's), maybe they could find <em>integer</em> periods (for modular arithmetic). This insight led directly to Shor's Factoring Algorithm.</p>
                `,
                quiz: [{ question: "Simon's Algorithm inspired:", options: ["Grover's", "Shor's", "HHL", "VQE"], correct: 1 }]
            }
        ]
    }
];

// Append to the global array
var part2Data = [
    {
        title: "8. Search & Amplitude",
        subsections: [
            {
                title: "8.1 The Search Problem",
                content: `
                <h3>Needle in a Haystack</h3>
                <p>Imagine you have a phone book with $N$ names, but the list is completely unsorted. If you want to find the phone number for "Alice", you have to check each entry one by one. In the worst case, you might have to check all $N$ entries. On average, you'll check $N/2$. In computer science terms, this is an $O(N)$ problem.</p>
                <p>This "unstructured search" is ubiquitous. Cracking a password, finding a key to a cipher, or solving a Sudoku puzzle can all be framed as "searching" through a massive space of possible solutions to find the one that works.</p>
                <p>Lov Grover (1996) shocked the world by proving that a quantum computer can solve this problem in $O(\\sqrt{N})$ steps. This is a <strong>Quadratic Speedup</strong>. While not exponential like Shor's, it is much more widely applicable. For a database of 1 million items, a classical computer checks 500,000 times. A quantum computer needs only about 1,000 steps. For a password of AES-128 encryption, Grover's algorithm effectively cuts the key length in half (to 64 bits), which is why we now recommend AES-256 for post-quantum security.</p>
                `,
                quiz: [{ question: "Grover's Algorithm offers what kind of speedup?", options: ["Exponential", "Quadratic", "Linear", "Constant"], correct: 1, explanation: "Square root of N vs N." }]
            },
            {
                title: "8.2 Grover's Mechanics",
                content: `
                <h3>Amplitude Amplification</h3>
                <p>Grover's algorithm doesn't "search" in the traditional sense of looking at items. Instead, it increases the probability amplitude of the correct answer while suppressing the wrong ones. It's a geometric rotation in Hilbert space.</p>
                <p>The algorithm consists of iterating two steps:</p>
                <ol>
                    <li><strong>Oracle Query:</strong> The system marks the correct state $|w\\rangle$ by flipping its phase (multiplying by -1). The rest are left alone.</li>
                    <li><strong>Diffuser (Inversion about the mean):</strong> This complex-looking operation reflects the state vector around the "average" amplitude.</li>
                </ol>
                <p>Geometrically, if you visualize the state vector starting near the "equal superposition" of all outcomes, each iteration rotates the vector by a small angle $\\theta$ towards the target solution $|w\\rangle$. After roughly $\\frac{\\pi}{4}\\sqrt{N}$ rotations, the vector points almost exactly at $|w\\rangle$. If you measure now, you get the answer with near 100% probability.</p>
                `,
                quiz: [{ question: "What geometric operation does Grover's use?", options: ["Translation", "Rotation", "Scaling", "Shearing"], correct: 1 }]
            },
            {
                title: "8.3 Optimality",
                content: `
                <h3>You Can't Do Better</h3>
                <p>One of the most profound results in quantum complexity theory is that Grover's Algorithm is <strong>Optimal</strong>. It was proven (by Bennett, Bernstein, Brassard, and Vazirani) that <em>no</em> quantum algorithm can solve the unstructured search problem faster than $O(\\sqrt{N})$.</p>
                <p>This bounds the power of quantum computing. It tells us that quantum computers are not "magic parallel machines" that check all answers instantly (which would be $O(1)$). They have limits. If you are looking for a generic solution to NP-Complete problems (brute force search), the best a quantum computer can ever offer is a quadratic speedup. This is huge, but it's not the "instant solution" often portrayed in media.</p>
                `,
                quiz: [{ question: "Is Grover's Algorithm optimal?", options: ["Yes", "No", "Maybe", "Unknown"], correct: 0 }]
            },
            {
                title: "8.4 Quantum Counting",
                content: `
                <h3>How Many Solutions?</h3>
                <p>Grover's algorithm assumes you want to find <em>one</em> marked item. But what if you want to know <em>how many</em> items satisfy the condition? This is the <strong>Quantum Counting</strong> problem.</p>
                <p>By combining Grover's operator with the Quantum Phase Estimation (QPE) algorithm, we can estimate the number of solutions $M$ without actually finding them. The Grover operator rotates the state at a frequency that depends on $M$. By extracting this frequency (finding the eigenvalue phase), we deduce $M$.</p>
                <p>This has applications in statistical estimation, Monte Carlo simulation, and database analytics, offering a quadratic speedup over classical sampling methods.</p>
                `,
                quiz: [{ question: "Quantum counting estimates:", options: ["Number of qubits", "Number of solutions", "Clock speed", "Error rate"], correct: 1 }]
            },
            {
                title: "8.5 Quantum Walks",
                content: `
                <h3>Random Walks on Steroids</h3>
                <p>In classical computer science, "Random Walks" are used to explore graphs, solve maze problems, and model diffusion. The walker flips a coin and moves left or right.</p>
                <p>A <strong>Quantum Walk</strong> replaces the coin with a "coin qubit" in superposition. Because the walker moves in superposition of left AND right, the different paths interfere. This leads to a radically different spreading behavior. A classical walker on a line spreads out proportional to $\\sqrt{t}$ (diffusive). A quantum walker spreads proportional to $t$ (ballistic).</p>
                <p>This "ballistic spread" means quantum walks can traverse graphs and find marked nodes quadratically faster than classical walks. They are the backbone of many advanced algorithms, including Element Distinctness and solving boolean formulas.</p>
                `,
                quiz: [{ question: "Quantum walks diffuse:", options: ["Slower", "Faster", "Same speed", "Backwards"], correct: 1 }]
            }
        ]
    },
    {
        title: "9. Phase & Period Finding",
        subsections: [
            {
                title: "9.1 Quantum Fourier Transform (QFT)",
                content: `
                <h3>The Engine of Speedup</h3>
                <p>The Discrete Fourier Transform (DFT) is one of the most useful mathematical tools in history, used in signal processing, image compression (JPEG), and multiplying large numbers. The Fast Fourier Transform (FFT) algorithm computes it in $O(N \\log N)$ time.</p>
                <p>The <strong>Quantum Fourier Transform (QFT)</strong> performs the same transformation on the amplitudes of a quantum state. Astonishingly, it does this in $O(n^2)$ gates (where $n = \\log N$ is the number of qubits). This means for a state of dimension $N=2^{100}$, QFT requires a few thousand operations, while classical FFT would require more operations than particles in the universe.</p>
                <p>However, there is a catch: you cannot access the output amplitudes directly (readout problem). You can only measure. This means QFT is rarely used to "process signals" directly but is used as a subroutine inside other algorithms like Period Finding.</p>
                `,
                quiz: [{ question: "QFT is the quantum version of:", options: ["DFT", "BFS", "DFS", "RSA"], correct: 0 }]
            },
            {
                title: "9.2 Quantum Phase Estimation (QPE)",
                content: `
                <h3>The Master Key</h3>
                <p>If you could ask a quantum mechanic for one tool, ask for Phase Estimation. It solves the following problem: Given a unitary $U$ and an eigenvector $|\\psi\\rangle$ (where $U|\\psi\\rangle = e^{2\\pi i \\theta} |\\psi\\rangle$), estimate the phase $\\theta$.</p>
                <p>The algorithm uses two registers. The first ("counting") register is put into superposition and controls $U^1, U^2, U^4...$ operations on the second register. This effectively writes the phase information into the Fourier basis of the first register. We then apply Inverse QFT to "read out" the phase $\\theta$ as a binary fraction.</p>
                <p>QPE is the engine behind Shor's Algorithm (Factoring), HHL (Linear Systems), and Quantum Chemistry (Energy Estimation). It turns "finding eigenvalues" (a hard linear algebra problem) into a quantum measurement.</p>
                `,
                quiz: [{ question: "QPE estimates:", options: ["Amplitude", "Phase/Eigenvalue", "Mass", "Spin"], correct: 1 }]
            },
            {
                title: "9.3 Order Finding",
                content: `
                <h3>The Math Behind Breaking RSA</h3>
                <p>The security of RSA encryption relies on the fact that factoring large numbers $N = p \\times q$ is hard. But factoring is intimately related to a modular arithmetic problem called <strong>Order Finding</strong>.</p>
                <p>The problem: Find the smallest integer $r$ such that $x^r \\equiv 1 \pmod N$ (where $x$ is some random integer coprime to $N$).
                Classically, this period $r$ can be huge, and finding it is as hard as factoring.</p>
                <p>Quantumly, this function $f(a) = x^a \pmod N$ is periodic with period $r$. By creating a superposition of all inputs and feeding it through this Modular Exponentiation function, the period $r$ gets encoded in the phases. We use Phase Estimation (or just QFT) to extract this period efficiently. Once we have $r$, a little classical algebra (Standard GCD) gives us the factors $p$ and $q$.</p>
                `,
                quiz: [{ question: "Shor's algorithm relies on:", options: ["Order Finding", "Search", "Cloning", "Teleportation"], correct: 0 }]
            },
            {
                title: "9.4 Shor's Algorithm",
                content: `
                <h3>The Algorithm That Changed Everything</h3>
                <p>In 1994, Peter Shor published his algorithm for integer factorization. He proved that a quantum computer could factor an integer $N$ in $O((\\log N)^3)$ time (effectively polynomial time). The best classical algorithm (General Number Field Sieve) runs in sub-exponential time, which is practically forever for large keys.</p>
                <p>This discovery arguably launched the entire field of quantum computing funding. It meant that if we could build a large enough quantum computer, nearly all public-key cryptography used on the internet (RSA, Diffie-Hellman, ECC) would be broken. Your credit card numbers, state secrets, and private emails would be readable.</p>
                <p>Running Shor's algorithm is incredibly demanding. Breaking RSA-2048 requires roughly 4000 logical qubits and millions of gates (billions of physical operations). We are years away, but the threat is mathematically proven.</p>
                `,
                quiz: [{ question: "Shor's algorithm breaks:", options: ["AES", "RSA", "OTP", "SHA-256"], correct: 1 }]
            },
            {
                title: "9.5 Implications",
                content: `
                <h3>Harvest Now, Decrypt Later</h3>
                <p>Even though large quantum computers don't exist yet, Shor's algorithm poses a threat <em>today</em>. This is the "Harvest Now, Decrypt Later" attack. Adversaries can record encrypted global traffic now and store it. In 10 or 20 years, when a quantum computer is built, they can use Shor's algorithm to decrypt that historical data.</p>
                <p>This urgency has spawned the field of <strong>Post-Quantum Cryptography (PQC)</strong>. NIST is currently standardizing new encryption schemes (based on Lattices, Codes, or Hash functions) that are believed to be immune to quantum attack. The migration to PQC is one of the largest software upgrades in history, and it is starting now.</p>
                `,
                quiz: [{ question: "When are we safe from Shor's?", options: ["Always", "Never", "Using PQC", "Using 5 bit keys"], correct: 2 }]
            }
        ]
    },
    {
        title: "10. Advanced Algorithms",
        subsections: [
            {
                title: "10.1 HHL Algorithm",
                content: `
                <h3>Solving System of Equations</h3>
                <p>In 2008, Harrow, Hassidim, and Lloyd (HHL) proposed an algorithm to solve systems of linear equations ($Ax = b$). This is a heavily used problem in engineering, fluid dynamics, finance, and machine learning.</p>
                <p>The HHL algorithm can output a quantum state $|x\\rangle$ representing the solution in time logarithmic in the dimension of the matrix ($O(\\log N)$). Classically, the best algorithms are linear in $N$. This is an exponential speedup.</p>
                <p>However, there are significant caveats.
                1. The output is a quantum state $|x\\rangle$. You cannot read out the vector $x$ values efficiently without destroying the speedup. You must verify some property of $x$ (like $|x^\\dagger M x|$).
                2. The matrix $A$ must be sparse and well-conditioned.
                3. Loading the input vector $b$ into the quantum state can be hard.
                Despite these limits, HHL is the basis for many Quantum Machine Learning algorithms.</p>
                `,
                quiz: [{ question: "HHL solves:", options: ["Linear Systems", "Differential Equations", "Integration", "Sorting"], correct: 0 }]
            },
            {
                title: "10.2 Hamiltonian Simulation",
                content: `
                <h3>Feynman's Original Dream</h3>
                <p>In 1982, Richard Feynman famously said, "Nature isn't classical, dammit, and if you want to make a simulation of nature, you'd better make it quantum mechanical."</p>
                <p>This is the problem of <strong>Hamiltonian Simulation</strong>. Given a Hamiltonian $H$ (describing a molecule or material), how does it evolve over time? ($U = e^{-iHt}$). Classically, this is exponentially hard because the state space explodes.</p>
                <p>Quantum computers simulate this naturally. We identify the qubits with the electrons of the module and map the interactions to gates. This application—simulating new drugs, catalysts for fertilizer, or high-temperature superconductors—is likely to be the first area where quantum computers demonstrate true, commercially valuable advantage ("Quantum Utility").</p>
                `,
                quiz: [{ question: "The 'Killer App' for quantum is likely:", options: ["Gaming", "Chemistry/Materials", "Word Processing", "Streaming"], correct: 1 }]
            },
            {
                title: "10.3 VQE (Variational Quantum Eigensolver)",
                content: `
                <h3>The Flagship of the NISQ Era</h3>
                <p>In the current era of Noisy Intermediate-Scale Quantum (NISQ) devices, we can't run deep circuits like Shor's. We need short, robust algorithms. <strong>VQE</strong> is the most promising candidate.</p>
                <p>VQE is a <strong>Hybrid Quantum-Classical Algorithm</strong>.
                1. The Quantum Computer acts as a coprocessor. It prepares a "guess" wavefunction $|\\psi(\\theta)\\rangle$ based on some parameters $\\theta$ and measures the energy.
                2. The Classical Computer takes this energy value and uses an optimizer (like Gradient Descent) to suggest new parameters $\\theta$ to lower the energy.
                3. We loop this until we find the minimum energy (Ground State).</p>
                <p>Because the classic computer handles the "heavy lifting" of optimization and the quantum computer only handles the exponentially complex state preparation, VQE is robust against some noise and fits well on modern hardware.</p>
                `,
                quiz: [{ question: "VQE is a ___ algorithm.", options: ["Pure", "Hybrid", "Classical", "Analog"], correct: 1 }]
            },
            {
                title: "10.4 QAOA",
                content: `
                <h3>Optimization for Everyone</h3>
                <p>The <strong>Quantum Approximate Optimization Algorithm (QAOA)</strong> is a cousin of VQE designed for combinatorial optimization problems (like MaxCut, Traveling Salesman, or Portfolio Optimization).</p>
                <p>It works by alternating between two Hamiltonians: a "Mixer" (that explores states) and a "Cost" (that encodes the problem). This structure mimics a process called "adiabatic evolution" but in discrete gate steps. The goal is to find a bitstring that maximizes a classical cost function.</p>
                <p>QAOA is one of the most studied algorithms today because its requirements are relatively low, and graph optimization problems are everywhere in logistics and finance. It is still an open research question whether QAOA can strictly beat the best classical heuristics.</p>
                `,
                quiz: [{ question: "QAOA is used for:", options: ["Optimization", "Factoring", "Search", "Email"], correct: 0 }]
            },
            {
                title: "10.5 Quantum ML",
                content: `
                <h3>Finding Patterns in High Dimensions</h3>
                <p>Machine Learning is all about finding patterns in data. Quantum computers manipulate vectors in unimaginably high-dimensional spaces ($2^{50}$ dimensions). <strong>Quantum Machine Learning (QML)</strong> asks: can we use this space to find patterns invisible to classical neural nets?</p>
                <p>One approach is the <strong>Quantum Support Vector Machine (QSVM)</strong>. It uses a "Quantum Kernel" to map data into a high-dimensional Hilbert space where complex non-linear boundaries become simple linear separations (planes). We can compute the distance between points in this massive space efficiently using the 'Swap Test'.</p>
                <p>While still in its infancy, QML promises not just faster training, but potentially better <em>generalization</em> on small datasets, using the quantum state to capture rich correlations.</p>
                `,
                quiz: [{ question: "QML exploits the high dimensionality of:", options: ["Hilbert Space", "Real Space", "Disk Space", "Time"], correct: 0 }]
            },
            {
                title: "10.6 Quantum Annealing",
                content: `
                <h3>A Different Path</h3>
                <p>All the algorithms discussed so far use the "Gate Model" (Circuit) paradigm. There is another approach called <strong>Quantum Annealing</strong> (championed by D-Wave Systems).</p>
                <p>Annealing relies on the <strong>Adiabatic Theorem</strong>. You start with a simple system in its ground state. You slowly ("adiabatically") deform the system until it turns into the complex system you want to solve. If you go slow enough, the physics guarantees you stay in the ground state—which is the optimal solution.</p>
                <p>Annealers are not universal computers (they can't run Shor's algorithm). They are specialized optimization solvers. They currently have thousands of qubits (5000+), far more than gate-model chips, but the qubits are noisier and less connected. They are used today for scheduling, traffic routing, and protein folding.</p>
                `,
                quiz: [{ question: "Quantum Annealing determines the:", options: ["Global Minimum", "Fourier Transform", "Phase", "Amplitude"], correct: 0 }]
            }
        ]
    },
    {
        title: "11. Complexity Theory",
        subsections: [
            {
                title: "11.1 BQP",
                content: `
                <h3>The New Class in Town</h3>
                <p><strong>BQP (Bounded-Error Quantum Polynomial Time)</strong> is the class of decision problems solvable by a quantum computer in polynomial time with an error probability of at most 1/3 (which can be reduced by repetition). It is the quantum equivalent of the classical class <strong>P</strong> (or strictly, BPP).</p>
                <p>The hierarchy is believed to be: $P \\subseteq BQP \\subseteq PSPACE$.
                We know BQP is at least as powerful as P because a quantum computer can simulate any classical circuit (using Toffolis).
                We believe BQP is strictly more powerful than P because of problems like Factoring and Simulation.
                However, BQP is likely <em>not</em> all-powerful. It is not expected to contain NP-Complete problems.</p>
                `,
                quiz: [{ question: "P is contained in BQP.", options: ["True", "False"], correct: 0 }]
            },
            {
                title: "11.2 Quantum Supremacy",
                content: `
                <h3>Crossing the Threshold</h3>
                <p><strong>Quantum Supremacy</strong> (or Quantum Advantage) is the moment a quantum device performs a calculation that is practically impossible for any classical supercomputer, regardless of whether that calculation is useful.</p>
                <p>In 2019, Google's Sycamore processor (53 qubits) claimed to achieve this. It performed a "Random Circuit Sampling" task in 200 seconds that they estimated would take the Summit supercomputer 10,000 years. (This claim was later contested and refined by IBM and others using better classical algorithms, but the milestone remains substantial). Supremacy proves that the Hilbert space is real and accessible, and that the exponential scaling works in practice.</p>
                `,
                quiz: [{ question: "Quantum Supremacy means:", options: ["We rule the world", "Solving an intractable problem", "Better generic performance", "Skynet"], correct: 1 }]
            },
            {
                title: "11.3 DiVincenzo's Criteria",
                content: `
                <h3>The Checklist for Building a Computer</h3>
                <p>In 2000, David DiVincenzo laid out 5 logical criteria necessary to build a working quantum computer. Any proposed hardware (ions, photons, silicon) is judged against this list:</p>
                <ol>
                    <li><strong>Scalability:</strong> A well-defined physical qubit system that can be scaled to many qubits.</li>
                    <li><strong>Initialization:</strong> Ability to prepare the state $|00...0\\rangle$ faithfully.</li>
                    <li><strong>Coherence:</strong> Long decoherence times (T1, T2) compared to the gate operation time.</li>
                    <li><strong>Universality:</strong> A universal set of quantum gates.</li>
                    <li><strong>Measurement:</strong> Ability to measure specific qubits efficiently.</li>
                </ol>
                <p>(There are 2 more for networking). While modern platforms hit most of these, satisfying <em>all</em> of them simultaneously at scale remains the grand engineering challenge.</p>
                `,
                quiz: [{ question: "How many DiVincenzo criteria are there?", options: ["3", "5", "10", "1"], correct: 1 }]
            },
            {
                title: "11.4 BQP vs NP",
                content: `
                <h3>Limits of Power</h3>
                <p>The public often confuses "Quantum Computers" with "Super-fast Parallel Computers". If QCs could try every answer in parallel and pick the right one instantly, they could solve NP-Complete problems (like Traveling Salesman or Tetris). This would mean $NP \\subseteq BQP$.</p>
                <p>Most complexity theorists believe this is <strong>FALSE</strong>. Quantum parallelism doesn't let you see all answers; it lets you interfere them. Since generic unstructured problems (like NP-Complete ones) lack the algebraic structure needed for interference (like Period Finding), quantum computers probably only offer quadratic speedups (Grover's) for them, not exponential. So, no, quantum computers likely won't solve <em>all</em> the world's hard problems.</p>
                `,
                quiz: [{ question: "Can QCs solve NP-Complete problems in polynomial time?", options: ["Likely Yes", "Likely No", "Proven Yes", "Proven No"], correct: 1 }]
            },
            {
                title: "11.5 The Polynomial Hierarchy",
                content: `
                <h3>Structural Collapse</h3>
                <p>Complexity theory is built on a hierarchy of classes (P, NP, PH, etc.). The structure of this hierarchy tells us about the difficulty of problems. One of the strongest arguments against "Classical Simulation of Quantum mechanics" is that if a classical computer <em>could</em> efficiently simulate quantum sampling, the <strong>Polynomial Hierarchy would collapse</strong> to the third level. Since we believe this hierarchy is infinite (or at least tall), it implies that quantum computing is indeed fundamentally distinct from and more powerful than classical probabilistic computing.</p>
                `,
                quiz: [{ question: "Complexity theory deals with:", options: ["Resource scaling", "Circuit design", "Cost of parts", "Team size"], correct: 0 }]
            }
        ]
    },
    {
        title: "12. Noise & Error",
        subsections: [
            {
                title: "12.1 Decoherence",
                content: `
                <h3>The Enemy of Quantumness</h3>
                <p>Schrödinger's Cat acts weird only as long as it is isolated inside the box. As soon as you open the box—or as soon as a single air molecule hits it—the state collapses. This process is <strong>Decoherence</strong>.</p>
                <p>Quantum information is encoded in the delicate phase relationships (amplitudes) between states. Any interaction with the environment (heat, radiation, magnetic fluctuation) entangles the qubit with the environment. From the perspective of the user, the qubit's information has "leaked out" into the universe. The pure quantum state turns into a classical mixed state, destroying superposition and computation.</p>
                `,
                quiz: [{ question: "Decoherence turns superpositions into:", options: ["Entanglement", "Mixed States", "Pure States", "Negatives"], correct: 1 }]
            },
            {
                title: "12.2 T1 and T2 Times",
                content: `
                <h3>Measuring Lifespan</h3>
                <p>We quantify the quality of a qubit using two relaxation time constants, borrowed from NMR physics:</p>
                <ul>
                    <li><strong>T1 (Amplitude Damping):</strong> The time it takes for a high-energy state $|1\\rangle$ to decay spontaneously to the ground state $|0\\rangle$ (releasing a photon/phonon). "How long does the bit flip stay flipped?"</li>
                    <li><strong>T2 (Phase Damping):</strong> The time it takes for a superposition $|+\\rangle$ to randomize its phase and become a mixture. "How long does the quantumness last?"</li>
                </ul>
                <p>T2 is typically shorter than T1 and is the limiting factor for gate depth. If a gate takes 20ns and your T2 is 20$\mu$s, you can only perform about 1000 operations before your data is garbage.</p>
                `,
                quiz: [{ question: "T1 is associated with:", options: ["Phase", "Energy", "Position", "Color"], correct: 1 }]
            },
            {
                title: "12.3 Bit Flip Code",
                content: `
                <h3>Redundancy Works</h3>
                <p>Classical computers protect against errors by making copies (0 -> 000). If one bit flips (010), the majority vote (0) wins. We can't simply copy qubits (No-Cloning), but we can <em>entangle</em> them using CNOTs to spread information.</p>
                <p>The <strong>3-Qubit Bit Flip Code</strong> encodes one logical qubit $|\\psi\\rangle = \alpha|0\\rangle + \beta|1\\rangle$ into three physical qubits: $\alpha|000\\rangle + \beta|111\\rangle$. If an X-error (bit flip) hits one qubit, it flips to e.g., $|100\\rangle$. We can detect this by measuring "parity" (Z1Z2 and Z2Z3) without measuring the data itself. These parity checks tell us exactly which qubit flipped, allowing us to fix it without destroying the superposition.</p>
                `,
                quiz: [{ question: "The 3-qubit bit flip code corrects:", options: ["X error", "Z error", "Y error", "Leakage"], correct: 0 }]
            },
            {
                title: "12.4 Phase Flip Code",
                content: `
                <h3>Quantum Errors are Different</h3>
                <p>Classically, the only error is a bit flip (0->1). Quantumly, we also have <strong>Phase Errors</strong> (Z error), where $|+\\rangle$ becomes $|-\\rangle$. This changes the sign of the phase without changing the 0/1 probability. It is subtle but fatal for algorithms.</p>
                <p>The <strong>3-Qubit Phase Flip Code</strong> works exactly like the Bit Flip code, but in the Hadamard basis. We first apply H gates to rotate $|0\\rangle \\to |+\\rangle$, effectively turning Z errors into X errors. Then we use the standard majority vote protection. This illustrates a key principle: quantum errors can be digitized into X (Bit) and Z (Phase) types.</p>
                `,
                quiz: [{ question: "Phase flip code works in which basis?", options: ["Computational", "Hadamard (+/-)", "Bell", "Random"], correct: 1 }]
            },
            {
                title: "12.5 Quantum Zeno Effect",
                content: `
                <h3>Freezing Time</h3>
                <p>The <strong>Quantum Zeno Effect</strong> is a phenomenon where frequent observation of a quantum system suppresses its evolution. If a state starts at $|0\\rangle$ and tries to rotate to $|1\\rangle$, but you verify "Are you 0?" a million times a second, the wavefunction is constantly collapsed back to $|0\\rangle$. It effectively freezes.</p>
                <p>This can be used for error suppression. By constantly "watching" the qubit (performing Error Correction syndrome measurements) fast enough, we can prevent it from drifting away from the correct logical state, suppressing decoherence by the act of checking for it.</p>
                `,
                quiz: [{ question: "Zeno effect: A watched pot...", options: ["Never boils", "Boils faster", "Explodes", "Evaporates"], correct: 0 }]
            },
            {
                title: "12.6 Dynamical Decoupling",
                content: `
                <h3>Echo in the Machine</h3>
                <p>Sometimes we don't need full error correction; we just need to extend the qubit's life. <strong>Dynamical Decoupling</strong> is an open-loop control technique derived from NMR "Spin Echo".</p>
                <p>If a qubit is sitting idle, environmental noise might slowly rotate its phase. If we apply a swift X-pulse (flip) halfway through, the noise continues but now "unwinds" the phase error it just created. A second flip at the end restores the state. By applying complex sequences of pulses (CPMG, XY4), we can average out the environmental noise to zero, dramatically extending T2 coherence times without any measurement overhead.</p>
                `,
                quiz: [{ question: "Dynamical decoupling uses:", options: ["Pulse sequences", "Measurement", "Teleportation", "New hardware"], correct: 0 }]
            }
        ]
    }
];

// Merge logic
if (typeof tutorialData !== 'undefined') {
    tutorialData = tutorialData.concat(part2Data);
}

// Append to the global array
var part3Data = [
    {
        title: "13. Fault Tolerance",
        subsections: [
            {
                title: "13.1 Shor Code",
                content: `
                <h3>The First Full Code</h3>
                <p>In 1995, Peter Shor (yes, the same one) demonstrated that it was possible to correct <em>any</em> single-qubit error, whether it was a bit flip, phase flip, or a combination. The <strong>9-Qubit Shor Code</strong> encodes one logical qubit into nine physical qubits. It works by concatenating the 3-qubit phase flip code with the 3-qubit bit flip code.</p>
                <p>The structure is elegant: three groups of three qubits. Inside each group, we protect against bit flips. Between the groups, we protect against phase flips. This proved that Quantum Error Correction (QEC) was theoretically possible. Before this, many physicists believed decoherence would forever prevent quantum computers from scaling.</p>
                `,
                quiz: [{ question: "How many physical qubits act as one logical qubit in Shor's code?", options: ["3", "5", "7", "9"], correct: 3 }]
            },
            {
                title: "13.2 Surface Codes",
                content: `
                <h3>The Industry Standard</h3>
                <p>While Shor's code is great theory, it's hard to wire up. The <strong>Surface Code</strong> (or Toric Code) is the leading candidate for building real fault-tolerant computers (like those from Google and IBM). It arranges qubits in a 2D checkerboard pattern on a chip.</p>
                <p>Half the qubits are "Data" qubits, and half are "Measurement" (ancilla) qubits. Each measurement qubit touches four neighbors, performing parity checks (PLAQUETTES). This geometry uses only nearest-neighbor connections, which fits perfectly on flat 2D chips. Errors appear as strings of flipped parity checks (syndromes), and we can "decode" them by matching endpoints of these strings. It has a very high threshold (nearly 1%), meaning it can tolerate a lot of noise.</p>
                `,
                quiz: [{ question: "Surface codes require:", options: ["Nearest neighbor connectivity", "All-to-All", "No connectivity", "4D space"], correct: 0 }]
            },
            {
                title: "13.3 Threshold Theorem",
                content: `
                <h3>The Goal of Engineering</h3>
                <p>Is it possible to compute forever? The <strong>Threshold Theorem</strong> says yes. It states that for a given code (like Surface Code), there exists a critical physical error rate $p_{th}$.</p>
                <p>If your physical gate error $p$ is below this threshold ($p < p_{th}$), adding more physical qubits to your logical qubit <em>exponentially suppresses</em> the logical error rate. If your error is above the threshold, adding more qubits makes things worse (more parts to break). We are currently right at the crossover point in history where the best experiments are just starting to beat the "break-even" point.</p>
                `,
                quiz: [{ question: "The threshold theorem guarantees:", options: ["Speedup", "Arbitrary accuracy", "Low memory", "Cheap hardware"], correct: 1 }]
            },
            {
                title: "13.4 Logical vs Physical",
                content: `
                <h3>The Quality Gap</h3>
                <p>Do not confuse the physical qubits on a chip (what companies market) with the logical qubits needed for an algorithm (what algorithms demand).</p>
                <p>A "Physical Qubit" is a noisy, fragile man-made object (a transmon, an ion). A "Logical Qubit" is a mathematical abstraction distributed over many physical qubits, effectively error-free. To run Shor's algorithm for 2048-bit RSA, we need about 4,000 logical qubits. However, to build those 4,000 logical qubits using Surface Code, we might need 20 million physical qubits. This 1,000:1 ratio is the massive overhead of error correction that we simply have to accept.</p>
                `,
                quiz: [{ question: "Ratio of physical to logical qubits is roughly:", options: ["1:1", "10:1", "1000:1", "1:100"], correct: 2 }]
            },
            {
                title: "13.5 Transversal Gates",
                content: `
                <h3>Safe Operations</h3>
                <p>Once you have encoded your information into a complex entangled blob of 100 physical qubits, how do you compute on it? You can't just unencode it, do the gate, and re-encode it (you'd loose protection).</p>
                <p>We need <strong>Transversal Gates</strong>. Ideally, to perform a logical X on the logical qubit, we just perform physical X gates on all the constituent physical qubits individually. This is "transversal" because the physical qubits don't talk to each other during the gate, preventing errors from spreading. Unfortunately, a famous theorem (Eastin-Knill) proves that a code cannot have a <em>universal</em> set of transversal gates. We can do some (like CNOT), but not all.</p>
                `,
                quiz: [{ question: "Transversal gates prevent:", options: ["Error propagation", "Computation", "Entanglement", "Measurement"], correct: 0 }]
            },
            {
                title: "13.6 Magic State Distillation",
                content: `
                <h3>Purifying Fuel</h3>
                <p>Since we can't do the T-gate transversally, how do we get universality? The standard trick is <strong>Magic State Distillation</strong>.</p>
                <p>We permit ourselves to create noisy, "dirty" T-states. Then, using a specialized circuit (a distillation factory), we consume several dirty states to produce one higher-fidelity "Magic State". We repeat this until the state is pure enough. We then use this magic state as a resource to teleport a T-gate onto our data. This process is extremely expensive, consuming 90% of the resources in a fault-tolerant computer's architecture, effectively creating a "fuel" of magic states to power the computation.</p>
                `,
                quiz: [{ question: "Magic States are needed for:", options: ["Clifford gates", "Universal Fault Tolerance", "Initialization", "Measurement"], correct: 1 }]
            },
            {
                title: "13.7 Knill-Laflamme Conditions",
                content: `
                <h3>The Math of Recovery</h3>
                <p>What exactly makes a code "work"? The <strong>Knill-Laflamme Conditions</strong> are the necessary and sufficient algebraic conditions that a subspace of Hilbert space must satisfy to be an error-correcting code.</p>
                <p>Basically, they state that for any two orthogonal logical states $|0_L\\rangle$ and $|1_L\\rangle$, and any possible error $E$:
                1. The error $E$ must not rotate $|0_L\\rangle$ into $|1_L\\rangle$ (undetectable logical error).
                2. We must be able to distinguish which error happened without learning anything about the encoded state itself.
                If these are met, we can physically recover the information.</p>
                `,
                quiz: [{ question: "Knill-Laflamme conditions relate to:", options: ["Error Correction", "Teleportation", "Search", "Annealing"], correct: 0 }]
            }
        ]
    },
    {
        title: "14. Hardware I: Solid State",
        subsections: [
            {
                title: "14.1 Superconducting Qubits",
                content: `
                <h3>The Leading Contender</h3>
                <p>Currently the most popular platform (Google Sycamore, IBM Eagle/Osprey, Rigetti). These are essentially LC (Inductor-Capacitor) circuits printed on a silicon wafer. However, ordinary LC circuits are linear oscillators (harmonic)—their energy levels are evenly spaced, so you can't isolate just the bottom two levels (0 and 1).</p>
                <p>The secret sauce is the <strong>Josephson Junction</strong>. It acts as a non-linear inductor. This makes the circuit "anharmonic," separating the $|0\\rangle \\to |1\\rangle$ transition frequency from $|1\\rangle \\to |2\\rangle$. We can now address the qubit with microwave pulses (4-5 GHz).</p>
                <p><strong>Pros:</strong> Very fast gates (nanoseconds), manufactured like chips.
                <strong>Cons:</strong> Very short coherence times ($\\sim 100 \mu s$), need extreme cooling, limited connectivity (only neighbors).</p>
                `,
                quiz: [{ question: "Superconducting qubits are based on:", options: ["Josephson Junctions", "Lasers", "Vacuum", "Topological matter"], correct: 0 }]
            },
            {
                title: "14.2 Silicon Spin Qubits",
                content: `
                <h3>Leveraging the Trillion Dollar Industry</h3>
                <p>We already know how to make billions of transistors on Silicon. <strong>Spin Qubits</strong> try to leverage this. A qubit is formed by trapping a single electron in a "Quantum Dot" (a nanopillar of silicon) and using its spin (Up/Down) as the 0/1 state.</p>
                <p>Because the electron is trapped in a tiny "pure" silicon cage (often Isotopically purified Si-28 to remove magnetic noise), it has very long coherence times (milliseconds). The gates are slower than superconducting, but the physical footprint is millions of times smaller. We could potentially fit millions of qubits on a chip the size of a fingernail (CMOS Integration).</p>
                `,
                quiz: [{ question: "Advantage of Silicon:", options: ["CMOS Compatibility", "Room Temp", "No lasers", "Big size"], correct: 0 }]
            },
            {
                title: "14.3 NV Centers",
                content: `
                <h3>Diamonds are Forever</h3>
                <p>A <strong>Nitrogen-Vacancy (NV) Center</strong> is a defect in a diamond crystal lattice where a carbon atom is replaced by a nitrogen atom next to a vacancy (hole). This defect traps an electron spin that can be controlled with green light and microwaves.</p>
                <p>Here is the miracle: The diamond lattice is so rigid that it shields the spin from vibration. <strong>It can work at Room Temperature.</strong> You can have a quantum computer on a table without a giant fridge. While hard to scale (hard to place defects exactly where you want them), they are incredible sensors for magnetic fields and are key candidates for quantum internet repeaters.</p>
                `,
                quiz: [{ question: "NV Centers are found in:", options: ["Silicon", "Diamond", "Gold", "Graphite"], correct: 1 }]
            },
            {
                title: "14.4 Topological Qubits",
                content: `
                <h3>The Holy Grail</h3>
                <p>Pursued famously by Microsoft (Station Q). The idea is to braid quasiparticles called <strong>Majorana Zero Modes</strong> on 2D nanowires. The quantum information is stored "globally" in the topology of the braid (like a knot). Local noise cannot untrained a knot.</p>
                <p>If this works, the hardware itself is fault-tolerant at the physical level! You wouldn't need Surface Code. However, the physics is incredibly elusive. Detecting a Majorana fermion is a Nobel-prize level challenge, and controlling them is even harder. It is the highest-risk, highest-reward path.</p>
                `,
                quiz: [{ question: "Topological qubits are protected by:", options: ["Geometry/Topology", "Shielding", "Lasers", "Code"], correct: 0 }]
            },
            {
                title: "14.5 Comparison",
                content: `
                <h3>Speed vs Life</h3>
                <p>When comparing solid-state qubit types, we look at operation speed vs. coherence time.</p>
                <ul>
                    <li><strong>Superconducting:</strong> The drag racer. Extremely fast gates (ns) but crashes quickly (short coherence). Good for high repetition.</li>
                    <li><strong>Spin Qubits:</strong> The marathon runner. Slower gates (tens of ns) but lasts much longer (ms).</li>
                    <li><strong>NV Centers:</strong> The specialist. Works in harsh conditions (room temp) but hard to wire together.</li>
                </ul>
                `,
                quiz: [{ question: "Which is faster (gate speed)?", options: ["Superconducting", "Spin", "Ion Trap", "NMR"], correct: 0 }]
            },
            {
                title: "14.6 Cryogenics",
                content: `
                <h3>The Coldest Place in the Universe</h3>
                <p>To run a superconducting chip, we need to cool it to 10-20 milliKelvin. That is colder than deep space (2.7 Kelvin). We use a marvel of thermodynamics called a <strong>Dilution Refrigerator</strong>.</p>
                <p>It works by mixing two isotopes of Helium ($^3He$ and $^4He$). When they separate (like oil and water), the endothermic phase transition absorbs heat from the environment. This silent, plumbing-heavy machine is the "golden chandelier" you see in every quantum computing photo. It is a major bottleneck for scaling: how do you fit 1 million wires into a fridge the size of a barrel without heating it up?</p>
                `,
                quiz: [{ question: "Dilution Refrigerators use:", options: ["He3/He4 isotopes", "Liquid Nitrogen", "Ice blocks", "Fans"], correct: 0 }]
            }
        ]
    },
    {
        title: "15. Hardware II: Atomic",
        subsections: [
            {
                title: "15.1 Trapped Ions",
                content: `
                <h3>Nature's Perfect Qubits</h3>
                <p>Why build an artificial atom (superconducting) when nature gives us perfect ones? In <strong>Trapped Ion</strong> computers (IonQ, Quantinuum), we take charged atoms (like Ytterbium or Calcium), strip an electron, and suspend them in a vacuum chamber using electromagnetic fields (Paul Trap).</p>
                <p>Because every Ytterbium ion in the universe is identical, there are no manufacturing defects. Coherence times are massive (seconds, minutes, even hours). We use lasers to perform gates. The fidelity is naturally very high.</p>
                <p>The downside? Ions repel each other. Moving them is slow. Logic gates take microseconds (1000x slower than superconducting). But because they stay alive so long, the "Clock cycles per lifetime" metric is excellent.</p>
                `,
                quiz: [{ question: "Trapped Ions have excellent:", options: ["Gate Speed", "Coherence Time", "Fabrication speed", "Cooling reqs"], correct: 1 }]
            },
            {
                title: "15.2 Neutral Atoms",
                content: `
                <h3>The New Challenger</h3>
                <p>Similar to ions, but using neutral atoms (like Rubidium) held by <strong>Optical Tweezers</strong> (focused laser beams). Because they are neutral, you can pack them much closer together than ions (no repulsion) in large 2D or 3D arrays.</p>
                <p>To do logic gates, we excite them to a "Rydberg State" where the atom puffs up to be huge. In this state, they interact strongly. This "Rydberg Blockade" allows for high-speed logic. Companies like Pasqal and QuEra are scaling this rapidly to hundreds of qubits, especially for simulation tasks.</p>
                `,
                quiz: [{ question: "Neutral atoms are held by:", options: ["Magnets", "Optical Tweezers", "Glue", "Wires"], correct: 1 }]
            },
            {
                title: "15.3 Photonics",
                content: `
                <h3>Computing at Light Speed</h3>
                <p>Qubits are photons. Information is encoded in polarization, path, or time-bin. The advantage? Light doesn't interact with the environment (zero decoherence) and works at room temperature. Also, it's naturally compatible with fiber optic networks.</p>
                <p>The challenge? Photons don't interact with <em>each other</em> either. Making a 2-qubit gate (CNOT) is probabilistically hard. Companies like PsiQuantum and Xanadu use "Measurement Based Quantum Computing" (MBQC), where they generate a massive entangled state (Cluster State) and carve out the computation by measuring it. It is a completely different architecture from the circuit model.</p>
                `,
                quiz: [{ question: "Photonic quantum computing works at:", options: ["Absolute Zero", "Room Temperature", "Sun surface", "Vacuum only"], correct: 1 }]
            },
            {
                title: "15.4 NMR",
                content: `
                <h3>The Grandfather</h3>
                <p>Nuclear Magnetic Resonance (NMR) was the platform for the first quantum algorithms in the late 90s (Shor's algorithm for 15 = 3x5 was first done here). It uses the spin of nuclei in molecules dissolved in liquid coffee!</p>
                <p>It works great for 2-7 qubits. But it hits a hard wall. The signal-to-noise ratio drops exponentially with the number of qubits because the state is highly mixed (hot). It is considered a specific non-scalable technology, but it taught us everything we know about optimal control pulses.</p>
                `,
                quiz: [{ question: "Why is NMR not scalable?", options: ["Signal to noise", "Too cold", "Toxic", "Too fast"], correct: 0 }]
            },
            {
                title: "15.5 Future Roadmap",
                content: `
                <h3>Where are we going?</h3>
                <p>The roadmap typically follows 3 eras:</p>
                <ol>
                    <li><strong>NISQ (Now):</strong> 50-1000 noisy qubits. Good for prototypes, VQE, and learning hardware physics. No Error Correction.</li>
                    <li><strong>Broad Quantum Advantage (5-10 years):</strong> Error mitigation (not full correction) allows us to simulate chemistry that beats supercomputers.</li>
                    <li><strong>Fault Tolerance (15+ years):</strong> Surface codes, millions of physical qubits, breaking RSA, universal computation.</li>
                </ol>
                <p>We are currently transitioning from Era 1 to Era 2. The race is on to find the first commercial value.</p>
                `,
                quiz: [{ question: "The goal is:", options: ["Fault Tolerance", "NISQ forever", "Analog", "8 qubits"], correct: 0 }]
            },
            {
                title: "15.6 Qudits",
                content: `
                <h3>More than Binary</h3>
                <p>Why limit ourselves to $|0\\rangle$ and $|1\\rangle$? Nature has many levels. An ion has many electron shells. A photon has many modes. We can use a <strong>Qudit</strong> with $d$ levels (e.g., Qutrit, $d=3$: $|0\\rangle, |1\\rangle, |2\\rangle$).</p>
                <p>Qudits can store more information ($\log_2 d$ bits per particle). They also offer shortcuts in circuits (e.g., a Toffoli gate is much easier to implement if you can temporarily use a 3rd energy level). While harder to control, they are a powerful resource for compact coding.</p>
                `,
                quiz: [{ question: "A Qutrit has how many basis states?", options: ["2", "3", "4", "10"], correct: 1 }]
            }
        ]
    },
    {
        title: "16. Reference",
        subsections: [
            {
                title: "16.1 Complexity Comparison",
                content: `
                <h2>Time Complexity: Classical vs Quantum</h2>
                <table border="1" style="width:100%; border-collapse: collapse; margin-top: 10px; color: white;">
                    <tr style="background: #333;"><th>Problem</th><th>Classical Best</th><th>Quantum</th><th>Speedup</th></tr>
                    <tr><td>Search (Unstructured)</td><td>$O(N)$</td><td>$O(\\sqrt{N})$ (Grover)</td><td>Quadratic</td></tr>
                    <tr><td>Factoring</td><td>$O(\\exp(n^{1/3}))$ (GNFS)</td><td>$O(n^3)$ (Shor)</td><td>Exponential</td></tr>
                    <tr><td>Linear Systems ($Ax=b$)</td><td>$O(N \kappa)$</td><td>$O(\\log(N)\kappa^2)$ (HHL)</td><td>Exponential</td></tr>
                    <tr><td>Simulating Quantum Mechanics</td><td>$O(\\exp(n))$</td><td>$O(poly(n))$</td><td>Exponential</td></tr>
                    <tr><td>Gradient Descent</td><td>$O(d)$</td><td>$O(\\sqrt{d})$</td><td>Quadratic</td></tr>
                    <tr><td>Collisions in Functions</td><td>$O(N^{1/2})$</td><td>$O(N^{1/3})$ (Brassard)</td><td>Polynomial</td></tr>
                </table>
                <br>
                <div class="note-box">
                    <p><strong>Key:</strong> $n$ = number of bits/qubits (input size), $N$ = $2^n$ (dimension of Hilbert space), $\kappa$ = condition number, $d$ = dimension of feature space.</p>
                </div>
                `,
                quiz: []
            },
            {
                title: "16.2 Gate Cheat Sheet",
                content: `
                 <h3>Common Gates</h3>
                 <p>Quick reference for the standard basis gates.</p>
                 <ul>
                    <li><strong>I (Identity):</strong> Do nothing. Wait.</li>
                    <li><strong>X (NOT):</strong> Bit flip. $|0\\rangle \leftrightarrow |1\\rangle$.</li>
                    <li><strong>Y:</strong> Bit flip + Phase flip ($i$).</li>
                    <li><strong>Z (Phase):</strong> Phase flip. $|1\\rangle \\to -|1\\rangle$.</li>
                    <li><strong>H (Hadamard):</strong> Superposition. $|0\\rangle \\to |+\\rangle$.</li>
                    <li><strong>S:</strong> $\\sqrt{Z}$. Phase of $i$.</li>
                    <li><strong>T:</strong> $\\sqrt{S}$. Phase of $e^{i\\pi/4}$. Essential for universality.</li>
                    <li><strong>CNOT (CX):</strong> Conditional bit flip. Entangler.</li>
                    <li><strong>CZ:</strong> Conditional phase flip. Symmetric.</li>
                    <li><strong>SWAP:</strong> Exchange two qubits.</li>
                    <li><strong>Toffoli (CCNOT):</strong> AND gate.</li>
                 </ul>
                <div class="matrix-container" data-matrix="X"></div>
                <div class="matrix-container" data-matrix="Z"></div>
                <div class="matrix-container" data-matrix="H"></div>
                <div class="matrix-container" data-matrix="CX" data-qubits="2"></div>
                `,
                quiz: []
            }
        ]
    },
    {
        title: "Certification",
        id: "certification_section",
        subsections: [
            {
                title: "Final Exam",
                id: "final_exam",
                content: "", // Engine handles this
                quiz: []
            }
        ]
    }
];

// Merge logic
if (typeof tutorialData !== 'undefined') {
    tutorialData = tutorialData.concat(part3Data);
}

// 100+ Question Pool for Final Exam
const finalExamQuestions = [
    { question: "What is the fundamental unit of quantum info?", options: ["Bit", "Qubit", "Byte", "Pixel"], correct: 1 },
    { question: "Superposition allows a qubit to be:", options: ["0 only", "1 only", "Linear combination of 0 and 1", "Both 0 and 1 deterministically"], correct: 2 },
    { question: "Entanglement implies:", options: ["Separability", "Non-local correlation", "Communications > c", "Nothing"], correct: 1 },
    { question: "Which gate is universal for classical reversible logic?", options: ["Toffoli", "CNOT", "X", "H"], correct: 0 },
    { question: "Bloch sphere represents:", options: ["1 qubit", "2 qubits", "Entanglement", "Gates"], correct: 0 },
    { question: "X gate corresponds to:", options: ["Null", "NOT", "AND", "OR"], correct: 1 },
    { question: "Z gate is a rotation around:", options: ["X axis", "Y axis", "Z axis", "Time"], correct: 2 },
    { question: "Shors algorithm factors in:", options: ["Exponential time", "Polynomial time", "Linear time", "Never"], correct: 1 },
    { question: "Grovers algorithm speedup is:", options: ["Quadratic", "Exponential", "None", "Linear"], correct: 0 },
    { question: "Deutsch Algorithm needs how many queries?", options: ["0", "1", "2", "3"], correct: 1 },
    { question: "No-Cloning theorem forbids:", options: ["Copying known states", "Copying unknown states", "Teleportation", "Measurement"], correct: 1 },
    { question: "Teleportation requires:", options: ["Entanglement + 2 classical bits", "Just entanglement", "Just classical bits", "Fiber optics"], correct: 0 },
    { question: "Superdense coding sends:", options: ["2 classical bits via 1 qubit", "2 qubits via 1 bit", "Faster than light", "Nothing"], correct: 0 },
    { question: "The probability of measuring 0 in |+> is:", options: ["0%", "50%", "100%", "25%"], correct: 1 },
    { question: "Bell state is:", options: ["Product state", "Maximally entangled", "Separable", "Classical"], correct: 1 },
    { question: "Measurement in quantum mechanics is:", options: ["Deterministic", "Probabilistic", "Reversible", "Impossible"], correct: 1 },
    { question: "Unitary matrices satisfy:", options: ["U†U = I", "U = I", "U† = U", "det(U)=0"], correct: 0 },
    { question: "QFT stands for:", options: ["Quantum Field Theory", "Quantum Fourier Transform", "Quantum Fast Track", "Quick Fourier"], correct: 1 },
    { question: "NISQ stands for:", options: ["Noisy Intermediate-Scale Quantum", "New International Standard", "Not Interesting", "Nice Intelligent System"], correct: 0 },
    { question: "Decoherence is caused by:", options: ["Environment interaction", "Bad code", "Fast gates", "Measurement"], correct: 0 },
    { question: "T1 time measures:", options: ["Relaxation/Energy loss", "Dephasing", "Gate speed", "Compilation"], correct: 0 },
    { question: "Surface code is a type of:", options: ["QEC Code", "Algorithm", "Gate", "Qubit"], correct: 0 },
    { question: "Majorana fermions are used in:", options: ["Topological Qubits", "Superconducting", "Ion Traps", "NMR"], correct: 0 },
    { question: "Neutral atoms use what for trapping?", options: ["Lasers / Tweezers", "Magnets", "Wires", "Glue"], correct: 0 },
    { question: "HHL algorithm solves:", options: ["Linear Systems", "Factoring", "Search", "Sorting"], correct: 0 },
    { question: "Class P contains problems solvable in:", options: ["Polynomial time classical", "Polynomial time quantum", "Exponential time", "Nondeterministic"], correct: 0 },
    { question: "BQP contains:", options: ["Problems solvable by QC", "Unsolvable problems", "All problems", "Only P"], correct: 0 },
    { question: "Quantum Supremacy was claimed by:", options: ["Google", "Apple", "Microsoft", "Amazon"], correct: 0 },
    { question: "BB84 is a protocol for:", options: ["Key Distribution", "Teleportation", "Coding", "Mining"], correct: 0 },
    { question: "EPR Paradox challenged:", options: ["Completeness of QM", "Relativity", "Gravity", "Light speed"], correct: 0 },
    { question: "Hidden Variable theories were ruled out by:", options: ["Bell's Inequalities", "Heisenberg", "Newton", "Planck"], correct: 0 },
    { question: "Toffoli gate is also:", options: ["CCNOT", "CNOT", "SWAP", "Fredkin"], correct: 0 },
    { question: "Fredkin gate is:", options: ["CSWAP", "CCNOT", "H", "S"], correct: 0 },
    { question: "VQE is good for:", options: ["Finding ground states", "Factoring", "Search", "Communications"], correct: 0 },
    { question: "QAOA is an:", options: ["Optimization algorithm", "Encryption", "Game", "Database"], correct: 0 },
    { question: "Quantum Annealing finds:", options: ["Global Minimum", "Factors", "Keys", "Fourier Transform"], correct: 0 },
    { question: "D-Wave machines use:", options: ["Annealing", "Gate Model", "Photons", "Ions"], correct: 0 },
    { question: "Ion Traps have:", options: ["Long coherence", "Fastest gates", "No cooling", "Low fidelity"], correct: 0 },
    { question: "Superconducting qubits are:", options: ["Artificial atoms", "Real atoms", "Photons", "Ions"], correct: 0 },
    { question: "NV Centers work at:", options: ["Room Temp", "0K", "100K", "Sun temp"], correct: 0 },
    { question: "Transmons are a type of:", options: ["Superconducting qubit", "Ion", "Atom", "Photon"], correct: 0 },
    { question: "Rabi oscillations show:", options: ["Qubit flipping", "Decoherence", "Entanglement", "Transport"], correct: 0 },
    { question: "Ramsey fringes measure:", options: ["Coherence / T2", "T1", "Gate fidelity", "Temperature"], correct: 0 },
    { question: "Which matrix is Identity?", options: ["[[1,0],[0,1]]", "[[0,1],[1,0]]", "[[1,0],[0,-1]]", "[[0,-i],[i,0]]"], correct: 0 },
    { question: "Hadamard squared (H*H) is:", options: ["Identity", "X", "Y", "Z"], correct: 0 },
    { question: "X*Z = ?", options: ["-iY", "Y", "I", "H"], correct: 0 },
    { question: "Tensor product of 2x2 and 2x2 is:", options: ["4x4", "2x2", "8x8", "1x1"], correct: 0 },
    { question: "Born rule calculates:", options: ["Probability", "Phase", "Energy", "Time"], correct: 0 },
    { question: "Schrodinger equation describes:", options: ["Time evolution", "Measurement", "Gravity", "Noise"], correct: 0 },
    { question: "Heisenberg uncertainty applies to:", options: ["Position/Momentum", "Bit/Qubit", "0/1", "Time/Space"], correct: 0 },
    { question: "Quantum tunneling allows:", options: ["Passing barriers", "Faster light", "Time travel", "Free energy"], correct: 0 },
    { question: "Spin 1/2 particles are:", options: ["Fermions", "Bosons", "Photons", "Phonons"], correct: 0 },
    { question: "Photons are:", options: ["Bosons", "Fermions", "Anyons", "Atoms"], correct: 0 },
    { question: "Which is a Clifford gate?", options: ["H", "T", "Toffoli", "Rz(0.1)"], correct: 0 },
    { question: "T gate is non-Clifford.", options: ["True", "False"], correct: 0 },
    { question: "Magic states are used for:", options: ["Fault Tolerant T gates", "Magic tricks", "Initialization", "Measurement"], correct: 0 },
    { question: "Knill-Laflamme conditions relate to:", options: ["QEC", "Teleportation", "Search", "Annealing"], correct: 0 },
    { question: "Stabilizer codes are described by:", options: ["Pauli operators", "Hamiltonians", "Currents", "Voltages"], correct: 0 },
    { question: "Toric code works on a:", options: ["Torus", "Sphere", "Plane", "Line"], correct: 0 },
    { question: "Quasiparticles are:", options: ["Excitations in solids", "Fake particles", "Photons", "Gravitons"], correct: 0 },
    { question: "Cooper pairs are:", options: ["Electron pairs", "Ion pairs", "Atom pairs", "Quark pairs"], correct: 0 },
    { question: "Josephson junction creates:", options: ["Non-linearity", "Linearity", "Resistance", "Heat"], correct: 0 },
    { question: "Cryostat keeps qubits:", options: ["Cold", "Hot", "Wet", "Dry"], correct: 0 },
    { question: "Dilution refrigerator uses:", options: ["He3/He4 mix", "Nitrogen", "Ice", "Freon"], correct: 0 },
    { question: "Fidelity measures:", options: ["Closeness of states", "Speed", "Size", "Cost"], correct: 0 },
    { question: "Qubit recycling allows:", options: ["Mid-circuit measurement", "Reusing atoms", "Saving power", "Green energy"], correct: 0 },
    { question: "Qudits have:", options: ["d levels", "2 levels", "1 level", "0 levels"], correct: 0 },
    { question: "A qutrit has:", options: ["3 levels", "2 levels", "4 levels", "8 levels"], correct: 0 },
    { question: "Schmidt decomposition applies to:", options: ["Bipartite pure states", "Mixed states", "Classical bits", "Gates"], correct: 0 },
    { question: "Von Neumann entropy measures:", options: ["Entanglement/Information", "Heat", "Volume", "Mass"], correct: 0 },
    { question: "Landauer's principle relates info to:", options: ["Energy/Heat", "Time", "Space", "Gravity"], correct: 0 },
    { question: "Reversible computing dissipates:", options: ["0 heat ideally", "Infinite heat", "Some heat", "All heat"], correct: 0 },
    { question: "Quantum biological effects found in:", options: ["Photosynthesis", "Digestion", "Thinking", "Walking"], correct: 0 },
    { question: "Penrose-Hameroff theory concerns:", options: ["Quantum Consciousness", "Gravity", "String Theory", "Big Bang"], correct: 0 },
    { question: "ER = EPR conjectures:", options: ["Entanglement = Wormholes", "Energy = Mass", "Time = Space", "Nothing"], correct: 0 },
    { question: "Which company has a 433 qubit processor (Osprey)?", options: ["IBM", "Google", "Intel", "Microsoft"], correct: 0 },
    { question: "Sycamore processor has how many qubits?", options: ["53", "1000", "5", "100"], correct: 0 },
    { question: "Qiskit is developed by:", options: ["IBM", "Google", "Microsoft", "Amazon"], correct: 0 },
    { question: "Cirq is developed by:", options: ["Google", "IBM", "Microsoft", "Intel"], correct: 0 },
    { question: "Q# is developed by:", options: ["Microsoft", "Google", "Apple", "IBM"], correct: 0 },
    { question: "PennyLane is for:", options: ["Quantum ML", "Circuit Design", "Chemistry", "Finance"], correct: 0 },
    { question: "OpenQASM is:", options: ["Assembly language", "High level language", "Operating System", "Hardware"], correct: 0 },
    { question: "ZX Calculus is a:", options: ["Graphical language", "Math subject", "Game", "Brand"], correct: 0 },
    { question: "Measurement Based QC uses:", options: ["Cluster states", "Gates", "Annealing", "Adiabatic"], correct: 0 },
    { question: "One-way quantum computer is:", options: ["MBQC", "Gate Model", "Reversible", "Classical"], correct: 0 },
    { question: "Gottesman-Knill theorem states:", options: ["Clifford circuits are typically estimatable", "QCs are slow", "Entanglement is useless", "Noise is bad"], correct: 0 },
    { question: "Solovay-Kitaev theorem guarantees:", options: ["Efficient gate approximation", "Exact compilation", "Fast search", "No errors"], correct: 0 },
    { question: "Trotter-Suzuki formula is for:", options: ["Hamiltonian Simulation", "Factoring", "Search", "Measurement"], correct: 0 },
    { question: "Variational Principle allows calculating:", options: ["Ground state energy", "Time evolution", "Phase", "Amplitude"], correct: 0 },
    { question: "Cost function landscape in VQE can have:", options: ["Barren Plateaus", "Mountains", "Rivers", "Forests"], correct: 0 },
    { question: "Barren Plateau problem means:", options: ["Gradients vanish", "Gradients explode", "No solution", "Too fast"], correct: 0 },
    { question: "Quantum Advantage is:", options: ["Practical speedup", "Theoretical proof", "Hype", "Marketing"], correct: 0 },
    { question: "Post-Quantum Cryptography uses:", options: ["Lattice problems", "Factorization", "Dlog", "Elliptic Curves"], correct: 0 },
    { question: "Lattice-based cryptography is:", options: ["Quantum resistant", "Quantum vulnerable", "Slow", "Weak"], correct: 0 },
    { question: "Learning Parity with Noise (LPN) is:", options: ["Hard problem", "Easy problem", "QML", "Protocol"], correct: 0 },
    { question: "Quantum Money is:", options: ["Unforgeable", "Bitcoin", "Cash", "Credit"], correct: 0 },
    { question: "Wiesner's Quantum Money uses:", options: ["Conjugate coding", "Blockchain", "Gold", "Paper"], correct: 0 }
];


