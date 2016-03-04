import 'source-map-support/register';
import { assert } from 'chai';
import { TSDI, Component, Inject, Factory } from '../lib/decorators';
import { User } from './user';
import { Dependency } from './dependency';

describe('TSDI', () => {

  describe('when creating a container instance', () => {

    let tsdi: TSDI;

    beforeEach(() => {
      tsdi = new TSDI();
    });

    afterEach(() => {
      tsdi.close();
    });

    it('a returned component should be of the requested instance', () => {
      tsdi.register(User);
      tsdi.register(Dependency);
      const user: User = tsdi.get(User);
      assert.isTrue(user instanceof User);
    });

    it('a returned instance should have all dependencies satisfied', () => {
      tsdi.register(User);
      tsdi.register(Dependency);
      const user: User = tsdi.get(User);
      assert.equal(user.method(), 'hello');
    });

    it('two returned instances should have the same dependency instances', () => {
      tsdi.register(User);
      tsdi.register(Dependency);
      const user1: User = tsdi.get(User);
      const user2: User = tsdi.get(User);
      assert.equal(user1.getDep(), user2.getDep());
    });

    it('a returned instance should call decorated lifecycle methods when available', () => {
      tsdi.register(User);
      tsdi.register(Dependency);
      const user: User = tsdi.get(User);
      assert.equal(user.initResult(), 'init');
    });

    it('enabling componentScanner should add all known components to the container', () => {
      tsdi.enableComponentScanner();
      const user: User = tsdi.get(User);
      assert.isTrue(user instanceof User);
    });

    it('a container with enabled componentScanner should lazy register components', () => {
      tsdi.enableComponentScanner();

      @Component()
      class Late {
      }

      const late: Late = tsdi.get(Late);
      assert.isTrue(late instanceof Late);
    });

    it('components could registered by name', () => {
      class A {}
      @Component()
      class B extends A {}

      tsdi.register(A);
      tsdi.register(B, 'Foo');
      assert.equal(tsdi.get(A, 'Foo'), tsdi.get(B));
    });

    it('components could registered with metadata', () => {
      class A {}
      @Component({name: 'RegisteredWithMetadata'})
      class B extends A {}

      tsdi.register(A);
      tsdi.register(B);
      assert.equal(tsdi.get(A, 'RegisteredWithMetadata'), tsdi.get(B));
    });

    it('components could be queried by name', () => {
      tsdi.enableComponentScanner();

      @Component()
      class A {
        public m(): string { return 'a'; }
      }

      @Component()
      class BExtendsA extends A {
        public m(): string { return 'b'; }
      }

      @Component({name: 'Foo'})
      class CExtendsA extends A {
        public m(): string { return 'c'; }
      }

      @Component({name: 'Bar'})
      class DExtendsA extends A {

        @Inject({name: 'Foo'})
        private a: A;

        public m(): string {
          return this.a.m();
        }
      }

      assert.equal(tsdi.get(A, 'Bar').m(), 'c');
    });

    it('should warn if register component with duplicate name', (done: MochaDone) => {
      class A {};
      class B {};

      const consoleWarn = console.warn;
      try {
        console.warn = function(msg: string): void {
          assert.equal(msg, "Component with name 'DuplicateComponentName' already registered.");
          done();
        };
        tsdi.register(A, 'DuplicateComponentName');
        tsdi.register(B, 'DuplicateComponentName');
      } finally {
        console.warn = consoleWarn;
      }
    });

    it('should inject defined properties', () => {
      @Component()
      class ComponentWithProperties {
        @Inject({name: 'prop'})
        private _prop: boolean;

        public get prop(): boolean { return this._prop; }
      }
      tsdi.addProperty('prop', false);
      tsdi.register(ComponentWithProperties);
      assert.equal(tsdi.get(ComponentWithProperties).prop, false);
    });

    it('should throw if requried component was not found', () => {
      @Component()
      class NonRegisteredComponent {}
      try {
        tsdi.get(NonRegisteredComponent);
        assert.fail('Should throw');
      } catch (e) {
        assert.equal(e.message, "Component 'NonRegisteredComponent' not found");
      }
    });

    it('should add itself to the component list', () => {
      tsdi.enableComponentScanner();

      @Component()
      class ComponentWithContainerDependency {
        @Inject()
        private _tsdi: TSDI;

        public get prop(): TSDI { return this._tsdi; }
      }
      assert.strictEqual(tsdi.get(ComponentWithContainerDependency).prop, tsdi);
    });

    it('should inject annotated constructor parameters', () => {
      tsdi.enableComponentScanner();

      @Component()
      class ConstructorParameterComponent {}

      @Component()
      class ComponentWithConstructor {
        private _tsdi: TSDI;

        constructor(@Inject() container: TSDI, @Inject() b: ConstructorParameterComponent) {
          this._tsdi = container;
        }

        public get prop(): TSDI { return this._tsdi; }
      }
      assert.strictEqual(tsdi.get(ComponentWithConstructor).prop, tsdi);
    });

    it('should create a new instance for non-singletons', () => {
      tsdi.enableComponentScanner();

      @Component({singleton: false})
      class NonSingletonComponent {}

      assert.notEqual(tsdi.get(NonSingletonComponent), tsdi.get(NonSingletonComponent));
    });

    it('should register factories on components', () => {
      tsdi.enableComponentScanner();

      class NonSingletonObject {}

      @Component()
      class FactoryComponentWithSingletonFactory {
        @Factory()
        public someFactory(): NonSingletonObject {
          return new NonSingletonObject();
        }
      }

      @Component()
      class C {}

      assert.instanceOf(tsdi.get(NonSingletonObject), NonSingletonObject);
      assert.strictEqual(tsdi.get(NonSingletonObject), tsdi.get(NonSingletonObject));
    });

    it('should return a new component on each call for non singleton factories', () => {
      tsdi.enableComponentScanner();

      class NonSingletonObject {}

      @Component()
      class FactoryComponentWithNonSingletonFactory {
        @Factory({singleton: false})
        public someFactory(): NonSingletonObject {
          return new NonSingletonObject();
        }
      }

      assert.instanceOf(tsdi.get(NonSingletonObject), NonSingletonObject);
      assert.notEqual(tsdi.get(NonSingletonObject), tsdi.get(NonSingletonObject));
    });

    it('inject should fallback to typename if no explicit name given', () => {
      tsdi.enableComponentScanner();

      @Component()
      class InjectedComponent {
      }

      @Component()
      class ComponentWithNonNamedInject {
        @Inject()
        private _comp: InjectedComponent;
        get comp(): InjectedComponent {
          return this._comp;
        }
      }

      assert.strictEqual(tsdi.get(ComponentWithNonNamedInject).comp, tsdi.get(InjectedComponent));
    });
  });

  describe('without container instance', () => {
    it('a created instance should not have dependencies satisified', () => {
      const comp: User = new User();
      assert.throw(comp.method);
    });

    it('a created instance should have mockable dependencies', () => {
      const comp: User = new User();
      comp['dependency'] = {
        echo(): string {
          return 'world';
        }
      };
      assert.equal(comp.method(), 'world');
    });
  });
});
